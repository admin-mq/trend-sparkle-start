// supabase/functions/pr-discover-mentions/index.ts
//
// Discovers candidate URLs that may mention a brand by running targeted
// DuckDuckGo searches. Each candidate is then handed to pr-fetch-mention,
// which fetches the page and runs a hard brand-presence gate before any
// AI analysis — so URLs that don't actually reference the brand are
// flagged as `not_a_mention` rather than fabricated into press coverage.
//
// We deliberately do NOT inject synthetic G2/Trustpilot/Capterra/Reddit
// "search result" URLs as if they were mentions. Those pages exist for
// every brand — including non-existent ones — so saving them as rows
// inflates the dashboard with non-mentions. If the user wants to track
// a specific review profile they can paste it manually.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTIONS_URL =
  Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  `${SUPABASE_URL}/functions/v1`;

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

async function searchDDG(query: string, limit = 10): Promise<Discovered[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
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

    for (const match of html.matchAll(/uddg=([^&"'\s]+)/g)) {
      try {
        const decoded = decodeURIComponent(match[1]);
        if (
          !decoded.startsWith("http") ||
          decoded.includes("duckduckgo.com") ||
          decoded.includes("google.com") ||
          // skip search/listing pages — they exist for every brand
          /[?&]q=/.test(decoded) ||
          /\/search\b/.test(decoded)
        ) continue;

        if (seen.has(decoded)) continue;
        seen.add(decoded);

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
  const domain = (project.domain ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  console.log(`Discovering mentions for brand: "${brand}" (${domain})`);

  // ── Run targeted searches in parallel ────────────────────────────────────
  // We bias toward queries likely to return PAGES that name the brand,
  // not search/listing pages on review platforms.
  const [
    newsResults,
    reviewResults,
    roundupResults,
    domainResults,
  ] = await Promise.all([
    searchDDG(`"${brand}" news`, 8),
    searchDDG(`"${brand}" review`, 6),
    searchDDG(`"${brand}" alternative OR comparison OR vs`, 6),
    domain ? searchDDG(`"${domain}" -site:${domain}`, 6) : Promise.resolve([]),
  ]);

  console.log(
    `DDG results — news:${newsResults.length} reviews:${reviewResults.length} roundups:${roundupResults.length} domain:${domainResults.length}`,
  );

  // ── Deduplicate across all sources, drop self-citations and existing rows ──
  const seen = new Set<string>();
  const all: Discovered[] = [];

  for (const item of [...newsResults, ...reviewResults, ...roundupResults, ...domainResults]) {
    if (seen.has(item.url) || existingUrls.has(item.url)) continue;
    // Skip the brand's own domain — self-citations are not external mentions
    if (domain && item.url.toLowerCase().includes(domain)) continue;
    seen.add(item.url);
    all.push(item);
  }

  console.log(`Total new candidate URLs: ${all.length}`);

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
  // pr-fetch-mention enforces the brand-presence gate; rows that don't
  // mention the brand will land as `not_a_mention` rather than as fake
  // analysed mentions.
  for (const mention of inserted ?? []) {
    fetch(`${FUNCTIONS_URL}/pr-fetch-mention`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ mention_id: mention.id }),
    }).catch((e) => console.error("fire fetch-mention error:", e));
  }

  return json({ found: all.length, new_count: all.length, urls: all.map((r) => r.url) });
});
