import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTIONS_URL =
  Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  `${SUPABASE_URL}/functions/v1`;

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceType = "article" | "review_site" | "roundup" | "social" | "other";

interface Discovered {
  url: string;
  title: string;
  source_type: SourceType;
}

// ── DuckDuckGo HTML search (returns real URLs via uddg param) ─────────────────
// DuckDuckGo's /html/ endpoint returns real URLs encoded in the uddg= parameter
// of each result link — no redirect following needed.

async function searchDDG(query: string, limit = 10): Promise<Discovered[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error(`DDG search failed: ${res.status} for query: ${query}`);
      return [];
    }

    const html = await res.text();
    const results: Discovered[] = [];
    const seen = new Set<string>();

    // DuckDuckGo result links contain: href="//duckduckgo.com/l/?uddg=ENCODED_URL&..."
    // The uddg value is the actual article URL, URL-encoded
    for (const match of html.matchAll(/uddg=([^&"'\s]+)/g)) {
      try {
        const decoded = decodeURIComponent(match[1]);
        if (
          !decoded.startsWith("http") ||
          decoded.includes("duckduckgo.com") ||
          decoded.includes("google.com")
        ) continue;

        if (seen.has(decoded)) continue;
        seen.add(decoded);

        // Extract title from nearby anchor text
        const titleMatch = html.slice(
          Math.max(0, html.indexOf(match[0]) - 200),
          html.indexOf(match[0]) + 300,
        ).match(/class="result__a"[^>]*>([^<]+)<\/a>/);
        const title = titleMatch ? titleMatch[1].trim() : "";

        results.push({
          url: decoded,
          title,
          source_type: classifyUrl(decoded, title),
        });

        if (results.length >= limit) break;
      } catch { /* skip malformed URLs */ }
    }

    console.log(`DDG "${query}": found ${results.length} results`);
    return results;
  } catch (err) {
    console.error(`DDG search error for "${query}":`, err);
    return [];
  }
}

// ── Deterministic brand review pages ─────────────────────────────────────────
// These are known-good URLs that always exist for major review platforms.
// No scraping needed — they're just constructed from the brand name.

function knownReviewPages(brand: string, domain: string): Discovered[] {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const domainSlug = domain.replace(/^www\./, "").replace(/\.[^.]+$/, "");

  return [
    {
      url: `https://www.g2.com/search?query=${encodeURIComponent(brand)}`,
      title: `${brand} reviews on G2`,
      source_type: "review_site",
    },
    {
      url: `https://www.trustpilot.com/search?query=${encodeURIComponent(domain)}`,
      title: `${brand} reviews on Trustpilot`,
      source_type: "review_site",
    },
    {
      url: `https://www.capterra.com/search/#query=${encodeURIComponent(brand)}`,
      title: `${brand} reviews on Capterra`,
      source_type: "review_site",
    },
    {
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(brand + " review")}&sort=top&t=year`,
      title: `Reddit discussions about ${brand}`,
      source_type: "social",
    },
  ];
}

function classifyUrl(url: string, title: string): SourceType {
  const u = url.toLowerCase();
  const t = title.toLowerCase();
  if (u.includes("g2.com") || u.includes("capterra.com") || u.includes("trustpilot.com") || u.includes("getapp.com") || u.includes("trustradius.com")) return "review_site";
  if (u.includes("reddit.com") || u.includes("twitter.com") || u.includes("x.com") || u.includes("linkedin.com") || u.includes("news.ycombinator.com")) return "social";
  if (t.includes("best ") || t.includes("top ") || t.includes(" vs ") || t.includes("alternative") || t.includes("comparison") || t.includes("roundup")) return "roundup";
  return "article";
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { project_id } = await req.json().catch(() => ({}));
  if (!project_id) return json({ error: "project_id required" }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const authHeader = req.headers.get("Authorization") ?? `Bearer ${SUPABASE_SERVICE_KEY}`;

  // ── Load project ──────────────────────────────────────────────────────────
  const { data: project } = await supabase
    .from("pr_projects")
    .select("id, brand_name, domain")
    .eq("id", project_id)
    .single();

  if (!project) return json({ error: "Project not found" }, 404);

  const { data: existing } = await supabase
    .from("pr_external_mentions")
    .select("url")
    .eq("project_id", project_id);

  const existingUrls = new Set((existing ?? []).map((m: { url: string }) => m.url));

  const brand = project.brand_name;
  const domain = project.domain ?? "";
  console.log(`Discovering mentions for brand: "${brand}" (${domain})`);

  // ── Run searches in parallel ──────────────────────────────────────────────
  const [newsResults, reviewResults, roundupResults] = await Promise.all([
    searchDDG(`"${brand}" news`, 8),
    searchDDG(`"${brand}" reviews site:g2.com OR site:capterra.com OR site:trustpilot.com`, 6),
    searchDDG(`"${brand}" best alternatives OR comparison OR vs`, 6),
  ]);

  // Deterministic review pages (always include if not already added)
  const knownPages = knownReviewPages(brand, domain);

  console.log(`DDG results — news:${newsResults.length} reviews:${reviewResults.length} roundups:${roundupResults.length} known:${knownPages.length}`);

  // ── Deduplicate across all sources ────────────────────────────────────────
  const seen = new Set<string>();
  const all: Discovered[] = [];

  for (const item of [...newsResults, ...reviewResults, ...roundupResults, ...knownPages]) {
    if (!seen.has(item.url) && !existingUrls.has(item.url)) {
      seen.add(item.url);
      all.push(item);
    }
  }

  console.log(`Total new items to save: ${all.length}`);

  if (all.length === 0) return json({ found: 0, new_count: 0, urls: [] });

  // ── Insert pending mentions ───────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from("pr_external_mentions")
    .insert(all.map((item) => ({
      project_id,
      url: item.url,
      source_type: item.source_type,
      status: "pending",
    })))
    .select("id");

  if (insertErr) {
    console.error("insert error:", insertErr);
    return json({ error: "Failed to save mentions", detail: insertErr.message }, 500);
  }

  // ── Fire pr-fetch-mention for each (fire and forget) ─────────────────────
  for (const mention of inserted ?? []) {
    fetch(`${FUNCTIONS_URL}/pr-fetch-mention`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ mention_id: mention.id }),
    }).catch((e) => console.error("fire fetch-mention error:", e));
  }

  return json({ found: all.length, new_count: all.length, urls: all.map((r) => r.url) });
});
