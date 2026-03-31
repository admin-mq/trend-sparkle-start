import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTIONS_URL =
  Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  `${SUPABASE_URL}/functions/v1`;

// ── Types ────────────────────────────────────────────────────────────────────

type SourceType = "article" | "review_site" | "roundup" | "social" | "other";

interface Discovered {
  url: string;
  title: string;
  source_type: SourceType;
}

// ── Resolve Google News redirect URLs to real article URLs ────────────────────
// Google News RSS links are redirect URLs (news.google.com/rss/articles/CBMi...)
// that can't be fetched programmatically. We extract the real URL from:
//   1. The <description> HTML (often contains the direct article link)
//   2. A HEAD fetch following the redirect chain

function extractRealUrlFromDescription(descHtml: string): string | null {
  // Decode any HTML entities
  const decoded = descHtml.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  // Find first href that's NOT a Google URL
  for (const m of decoded.matchAll(/href=["']?(https?:\/\/[^"'\s>]+)/g)) {
    const url = m[1];
    if (!url.includes("google.com") && url.startsWith("http")) {
      return url;
    }
  }
  return null;
}

async function resolveGoogleRedirect(url: string): Promise<string | null> {
  try {
    // Use GET with redirect:follow — res.url gives the final destination
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8_000),
    });
    const finalUrl = res.url;
    // If the redirect resolved to a non-Google page, use it
    if (
      finalUrl &&
      !finalUrl.includes("news.google.com") &&
      !finalUrl.includes("accounts.google") &&
      finalUrl.startsWith("http")
    ) {
      return finalUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveUrl(rawUrl: string, descHtml: string): Promise<string | null> {
  // If it's not a Google redirect, use as-is
  if (!rawUrl.includes("news.google.com")) return rawUrl;

  // Try description HTML first (fast, no network call)
  const fromDesc = extractRealUrlFromDescription(descHtml);
  if (fromDesc) return fromDesc;

  // Fallback: follow the redirect chain
  const fromRedirect = await resolveGoogleRedirect(rawUrl);
  return fromRedirect; // null if we couldn't resolve
}

// ── Google News RSS search ────────────────────────────────────────────────────

async function searchGoogleNews(query: string, limit = 10): Promise<Discovered[]> {
  const encoded = encodeURIComponent(query);
  const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NewsBot/1.0; +https://narrativeos.com)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];

    const xml = await res.text();

    // Resolve all items in parallel (with a concurrency cap)
    const rawItems: { url: string; descHtml: string; title: string }[] = [];

    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = match[1];

      const linkMatch =
        item.match(/<link>([^<\s]+)<\/link>/) ||
        item.match(/<link>[\s\S]*?<!\[CDATA\[(.*?)\]\]><\/link>/);
      const titleMatch =
        item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        item.match(/<title>([\s\S]*?)<\/title>/);
      const descMatch =
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        item.match(/<description>([\s\S]*?)<\/description>/);

      const rawUrl = linkMatch?.[1]?.trim();
      const title = titleMatch?.[1]?.trim() ?? "";
      const descHtml = descMatch?.[1]?.trim() ?? "";

      if (!rawUrl || !rawUrl.startsWith("http")) continue;
      rawItems.push({ url: rawUrl, descHtml, title });
      if (rawItems.length >= limit * 2) break; // collect extra to account for failed resolutions
    }

    // Resolve all URLs in parallel (cap at 10 concurrent)
    const results: Discovered[] = [];
    const seen = new Set<string>();

    const resolveAll = rawItems.slice(0, limit * 2).map(async (item) => {
      const resolved = await resolveUrl(item.url, item.descHtml);
      if (!resolved) return;
      if (seen.has(resolved)) return;
      seen.add(resolved);
      results.push({
        url: resolved,
        title: item.title,
        source_type: classifyUrl(resolved, item.title),
      });
    });

    await Promise.all(resolveAll);
    return results.slice(0, limit);
  } catch (err) {
    console.error("searchGoogleNews error:", query, err);
    return [];
  }
}

function classifyUrl(url: string, title: string): SourceType {
  const u = url.toLowerCase();
  const t = title.toLowerCase();

  if (
    u.includes("g2.com") ||
    u.includes("capterra.com") ||
    u.includes("trustpilot.com") ||
    u.includes("getapp.com") ||
    u.includes("trustradius.com") ||
    u.includes("softwareadvice.com")
  ) return "review_site";

  if (
    u.includes("reddit.com") ||
    u.includes("twitter.com") ||
    u.includes("x.com") ||
    u.includes("linkedin.com") ||
    u.includes("quora.com") ||
    u.includes("news.ycombinator.com")
  ) return "social";

  if (
    t.includes("best ") ||
    t.includes("top ") ||
    t.includes(" vs ") ||
    t.includes("alternative") ||
    t.includes("comparison") ||
    t.includes("roundup")
  ) return "roundup";

  return "article";
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const { project_id } = await req.json().catch(() => ({}));
  if (!project_id) {
    return new Response(JSON.stringify({ error: "project_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const authHeader =
    req.headers.get("Authorization") ?? `Bearer ${SUPABASE_SERVICE_KEY}`;

  // ── Load project ────────────────────────────────────────────────────────────
  const { data: project } = await supabase
    .from("pr_projects")
    .select("id, brand_name, domain")
    .eq("id", project_id)
    .single();

  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Load existing mention URLs to avoid dupes ─────────────────────────────
  const { data: existing } = await supabase
    .from("pr_external_mentions")
    .select("url")
    .eq("project_id", project_id);

  const existingUrls = new Set(
    (existing ?? []).map((m: { url: string }) => m.url),
  );

  const brand = project.brand_name;
  console.log(`Discovering mentions for brand: "${brand}"`);

  // ── Run 4 targeted searches in parallel ────────────────────────────────────
  const [newsResults, reviewResults, roundupResults, g2Results] =
    await Promise.all([
      searchGoogleNews(`"${brand}"`, 8),
      searchGoogleNews(`"${brand}" review 2024 OR 2025`, 6),
      searchGoogleNews(`"${brand}" best alternatives OR comparison`, 6),
      searchGoogleNews(`site:g2.com OR site:capterra.com "${brand}"`, 5),
    ]);

  console.log(
    `Raw results — news:${newsResults.length} reviews:${reviewResults.length} roundups:${roundupResults.length} g2:${g2Results.length}`,
  );

  // ── Deduplicate across all searches ────────────────────────────────────────
  const seen = new Set<string>();
  const all: Discovered[] = [];

  for (const item of [
    ...newsResults,
    ...reviewResults,
    ...roundupResults,
    ...g2Results,
  ]) {
    if (!seen.has(item.url) && !existingUrls.has(item.url)) {
      seen.add(item.url);
      all.push(item);
    }
  }

  console.log(`Deduplicated new items: ${all.length}`);

  if (all.length === 0) {
    return new Response(
      JSON.stringify({ found: 0, new_count: 0, urls: [] }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Insert pending mentions ────────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from("pr_external_mentions")
    .insert(
      all.map((item) => ({
        project_id,
        url: item.url,
        source_type: item.source_type,
        status: "pending",
      })),
    )
    .select("id");

  if (insertErr) {
    console.error("insert error:", insertErr);
    return new Response(
      JSON.stringify({ error: "Failed to save mentions", detail: insertErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Fire pr-fetch-mention for each (fire and forget) ──────────────────────
  for (const mention of inserted ?? []) {
    fetch(`${FUNCTIONS_URL}/pr-fetch-mention`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({ mention_id: mention.id }),
    }).catch((e) => console.error("fire fetch-mention error:", e));
  }

  return new Response(
    JSON.stringify({
      found: all.length,
      new_count: all.length,
      urls: all.map((r) => r.url),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
