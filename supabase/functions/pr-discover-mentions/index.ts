import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTIONS_URL =
  Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  `${SUPABASE_URL}/functions/v1`;

// ── Types ────────────────────────────────────────────────────────────────────

type SourceType =
  | "article"
  | "review_site"
  | "roundup"
  | "social"
  | "other";

interface Discovered {
  url: string;
  title: string;
  source_type: SourceType;
}

// ── Google News RSS search ────────────────────────────────────────────────────

async function searchGoogleNews(
  query: string,
  limit = 10,
): Promise<Discovered[]> {
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
    const results: Discovered[] = [];
    const seen = new Set<string>();

    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = match[1];

      // Google News RSS puts the article link in a <link> tag AFTER </title>
      // It can also appear as a plain text node between <link> and </link>
      const linkMatch =
        item.match(/<link>([^<\s]+)<\/link>/) ||
        item.match(/<link>[\s\S]*?<!\[CDATA\[(.*?)\]\]><\/link>/);
      const titleMatch =
        item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        item.match(/<title>([\s\S]*?)<\/title>/);

      const rawUrl = linkMatch?.[1]?.trim();
      const title = titleMatch?.[1]?.trim() ?? "";

      if (!rawUrl || !rawUrl.startsWith("http")) continue;

      // Deduplicate within this search
      if (seen.has(rawUrl)) continue;
      seen.add(rawUrl);

      results.push({ url: rawUrl, title, source_type: classifyUrl(rawUrl, title) });
      if (results.length >= limit) break;
    }

    return results;
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
    u.includes("hackernews") ||
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
  const authHeader = req.headers.get("Authorization") ?? `Bearer ${SUPABASE_SERVICE_KEY}`;

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

  // ── Load existing mention URLs (to avoid dupes) ────────────────────────────
  const { data: existing } = await supabase
    .from("pr_external_mentions")
    .select("url")
    .eq("project_id", project_id);

  const existingUrls = new Set((existing ?? []).map((m: { url: string }) => m.url));

  const brand = project.brand_name;

  // ── Run 4 targeted searches in parallel ────────────────────────────────────
  const [newsResults, reviewResults, roundupResults, g2Results] =
    await Promise.all([
      searchGoogleNews(`"${brand}"`, 10),
      searchGoogleNews(`"${brand}" review 2024 OR 2025`, 8),
      searchGoogleNews(`"${brand}" best alternatives OR comparison`, 8),
      searchGoogleNews(`site:g2.com OR site:capterra.com "${brand}"`, 6),
    ]);

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
