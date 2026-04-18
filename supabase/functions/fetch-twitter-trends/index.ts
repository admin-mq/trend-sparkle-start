import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// trends24.in region slugs
const REGION_SLUGS: Record<string, string> = {
  'UK':           'united-kingdom',
  'USA':          'united-states',
  'India':        'india',
  'Canada':       'canada',
  'Australia':    'australia',
  'Global':       'worldwide',
  'Nigeria':      'nigeria',
  'South Africa': 'south-africa',
  'Pakistan':     'pakistan',
  'Brazil':       'brazil',
};

const ALL_CATEGORIES = [
  'Entertainment','Music','Politics','Sports','Tech','AI',
  'Gaming','Culture','Finance','News','Religion','Fashion','Entrepreneurship',
];

const BATCH_SIZE = 5;
const PERPLEXITY_MODEL = 'sonar';

// ── Robust JSON extractor ────────────────────────────────────────────────────
function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  return null;
}

// ── Decode HTML entities ─────────────────────────────────────────────────────
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// ── Scrape trends24.in directly via HTML fetch ───────────────────────────────
async function scrapeTrends24(regionSlug: string, count: number): Promise<string[]> {
  const url = `https://trends24.in/${regionSlug}/`;
  console.log(`[fetch-twitter-trends] Scraping ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error(`trends24.in HTTP ${res.status}`);
  const html = await res.text();

  const olMatch = html.match(/<ol[^>]*class=["']?trend-card__list["']?[^>]*>([\s\S]*?)<\/ol>/);
  if (!olMatch) throw new Error('trends24.in structure changed — no trend-card__list found');

  const linkRegex = /class=["']?trend-link["']?[^>]*>([^<]+)<\/a>/g;
  const trends: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(olMatch[1])) !== null) {
    const name = decodeHtmlEntities(m[1].trim());
    if (name && !trends.includes(name)) trends.push(name);
    if (trends.length >= count) break;
  }

  if (trends.length === 0) throw new Error('trends24.in returned no trends for this region');
  console.log(`[fetch-twitter-trends] Scraped ${trends.length} trends:`, trends.slice(0, 5).join(', '));
  return trends;
}

// ── Fetch category-specific trending topics via Perplexity ───────────────────
// trends24.in only surfaces Twitter's native trending list (mostly sports +
// entertainment). Niche categories like Tech/AI/Entrepreneurship rarely crack
// that list. This fills the gap by asking Perplexity what's *actually* being
// discussed on X within the user's selected categories right now.
async function fetchCategoryTrends(
  apiKey: string,
  categories: string[],
  region: string,
  today: string
): Promise<string[]> {
  const prompt = `Find the MOST discussed topics on X/Twitter in ${region} today (${today}) within these categories: ${categories.join(', ')}.

Rules:
1. Search X/Twitter and recent news from the last 6 hours
2. Topics must be SPECIFIC — product names, people, events, hashtags, launches, controversies
3. Do NOT return generic terms like "AI", "Technology", "Business" — these are useless
4. Prioritize what is actively buzzing with tweets right now

Good examples: "Claude Opus 4.7", "#WWDC", "Sam Altman interview", "Vision Pro 2", "OpenAI outage"
Bad examples: "AI", "Tech", "Programming", "Entrepreneurship"

Return 3-5 topics per category, max 15 total. JSON array of strings only (no markdown):
["topic1", "topic2", ...]`;

  console.log(`[fetch-twitter-trends] Fetching category-specific trends for: ${categories.join(', ')}`);

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          { role: 'system', content: 'You have live X/Twitter web search. Return only JSON arrays of specific topics currently active and buzzing today.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.warn(`[fetch-twitter-trends] Category trends HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const json = extractJson(text);
    const arr = Array.isArray(json) ? json : (Array.isArray(json?.topics) ? json.topics : []);
    const filtered = arr
      .filter((x: any) => typeof x === 'string' && x.length > 0 && x.length < 80)
      .slice(0, 15);
    console.log(`[fetch-twitter-trends] Got ${filtered.length} category-specific trends:`, filtered.slice(0, 3).join(', '));
    return filtered;
  } catch (err) {
    console.warn('[fetch-twitter-trends] Category trends fetch failed:', err);
    return [];
  }
}

// ── Verify a small batch of trends with focused Perplexity search ────────────
async function verifyBatch(
  apiKey: string,
  batch: string[],
  startIdx: number,
  region: string,
  todayShort: string
): Promise<any[]> {
  const fallback = (reason: string) => batch.map((name, i) => ({
    rank: startIdx + i + 1,
    name,
    category: 'News',
    velocity: 'stable',
    freshness_hours: 0,
    why_trending: reason,
    confidence: 'low',
    marketer_signal: null,
  }));

  const prompt = `Today is ${todayShort}. These topics are trending on X/Twitter in ${region}. For EACH one, search the web (try "{topic} news ${todayShort}" and "{topic} twitter today") to find WHY it's trending.

TRENDS TO VERIFY:
${batch.map((t, i) => `${i + 1}. ${t}`).join('\n')}

CONFIDENCE CALIBRATION (important — don't default to "low"):
- "high"   = you found a specific news article from today/yesterday naming the exact reason
- "medium" = you found context (older article, wiki entry, known person/product, recent social activity) but no dated article — USE THIS AS DEFAULT if ANY relevant context exists
- "low"    = ONLY when you found absolutely NO information about this topic at all

Target: 80%+ of trends should be medium or high. These topics ARE actively trending so reasons exist — find them.

Categories: ${ALL_CATEGORIES.join(' | ')}
Velocity: rising (< 2h) | stable (2-6h) | fading (> 6h)

Return ALL ${batch.length} trends. JSON only (no markdown fences):
{
  "trends": [
    {
      "name": "<exact trend name>",
      "category": "<one from list>",
      "velocity": "rising|stable|fading",
      "freshness_hours": 3,
      "why_trending": "Specific reason, max 15 words",
      "confidence": "high|medium|low",
      "marketer_signal": "Brand angle, max 12 words, or null if confidence=low"
    }
  ]
}`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          { role: 'system', content: 'You verify trending topics using live web search. Search per-topic. Be decisive: if a topic is trending on X, a reason exists — find it. Avoid over-using "low" confidence.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[fetch-twitter-trends] Batch ${startIdx} HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return fallback('Verification unavailable');
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const parsed = extractJson(text);

    if (!parsed || !Array.isArray(parsed.trends)) {
      console.warn(`[fetch-twitter-trends] Batch ${startIdx} JSON parse failed. Raw: ${text.slice(0, 200)}`);
      return fallback('Parse failed');
    }

    // Map parsed trends back to input names (case-insensitive), fill gaps
    const byName = new Map<string, any>();
    for (const t of parsed.trends) {
      if (t?.name && typeof t.name === 'string') {
        byName.set(t.name.toLowerCase().trim(), t);
      }
    }

    return batch.map((name, i) => {
      const matched = byName.get(name.toLowerCase().trim());
      if (matched) {
        return {
          rank: startIdx + i + 1,
          name,
          category: matched.category || 'News',
          velocity: matched.velocity || 'stable',
          freshness_hours: typeof matched.freshness_hours === 'number' ? matched.freshness_hours : 0,
          why_trending: matched.why_trending || 'Reason unverified',
          confidence: matched.confidence || 'low',
          marketer_signal: matched.marketer_signal ?? null,
        };
      }
      return {
        rank: startIdx + i + 1,
        name,
        category: 'News',
        velocity: 'stable',
        freshness_hours: 0,
        why_trending: 'Reason unverified',
        confidence: 'low',
        marketer_signal: null,
      };
    });
  } catch (err) {
    console.warn(`[fetch-twitter-trends] Batch ${startIdx} error:`, err);
    return fallback('Verification failed');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { region = 'UK', categories = [], count = 20 } = await req.json();
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');

    const regionSlug = REGION_SLUGS[region] || 'worldwide';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const todayShort = new Date().toISOString().split('T')[0];

    // ── PASS 1a: Scrape trends24.in ───────────────────────────────────────────
    let rawTrends: string[];
    try {
      rawTrends = await scrapeTrends24(regionSlug, count);
    } catch (scrapeErr) {
      console.error('[fetch-twitter-trends] Pass 1 scrape failed:', scrapeErr);
      throw new Error(`Failed to fetch trends from trends24.in: ${scrapeErr instanceof Error ? scrapeErr.message : 'unknown'}`);
    }

    // ── PASS 1b: Supplementary category trends (if categories selected) ──────
    let combinedTrends = rawTrends;
    let supplementaryCount = 0;
    if (categories.length > 0) {
      const catTrends = await fetchCategoryTrends(PERPLEXITY_API_KEY, categories, region, today);
      const seen = new Set(rawTrends.map(t => t.toLowerCase()));
      const unique = catTrends.filter(t => !seen.has(t.toLowerCase()));
      supplementaryCount = unique.length;
      // Category-specific trends lead the list so they're visible; cap at 30 total
      combinedTrends = [...unique, ...rawTrends].slice(0, Math.max(rawTrends.length, 30));
    }

    // ── PASS 2: Parallel batched verification ────────────────────────────────
    console.log(`[fetch-twitter-trends] Verifying ${combinedTrends.length} trends (${supplementaryCount} supplementary) in parallel batches of ${BATCH_SIZE}`);

    const batches: string[][] = [];
    for (let i = 0; i < combinedTrends.length; i += BATCH_SIZE) {
      batches.push(combinedTrends.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map((batch, i) =>
        verifyBatch(PERPLEXITY_API_KEY, batch, i * BATCH_SIZE, region, todayShort)
      )
    );

    let finalTrends: any[] = batchResults.flat();

    // Sort: category matches first, then by original rank within each bucket
    if (categories.length > 0) {
      const prioritySet = new Set((categories as string[]).map(c => c.toLowerCase()));
      finalTrends = finalTrends
        .sort((a: any, b: any) => {
          const aMatch = prioritySet.has((a.category || '').toLowerCase()) ? 0 : 1;
          const bMatch = prioritySet.has((b.category || '').toLowerCase()) ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return (a.rank || 99) - (b.rank || 99);
        })
        .map((t: any, i: number) => ({ ...t, rank: i + 1 }));
    }

    const verifiedCount = finalTrends.filter((t: any) => t.confidence !== 'low').length;
    const highConfCount = finalTrends.filter((t: any) => t.confidence === 'high').length;

    // Top insight: first high-confidence trend with a marketer_signal
    const featured = finalTrends.find((t: any) => t.confidence === 'high' && t.marketer_signal)
                  || finalTrends.find((t: any) => t.confidence !== 'low' && t.marketer_signal);
    const topInsight = featured
      ? `"${featured.name}" is a live opportunity — ${featured.marketer_signal}`
      : 'Scan complete. Pick a trend to generate on-brand tweet drafts.';

    const accuracyNotes = verifiedCount === 0
      ? 'Verification returned low confidence for all trends — live context will be fetched per trend when you generate tweets.'
      : `${verifiedCount}/${finalTrends.length} trends verified (${highConfCount} with direct article confirmation).`;

    console.log(`[fetch-twitter-trends] Done — ${finalTrends.length} trends, ${verifiedCount} verified (${highConfCount} high-confidence)`);

    return new Response(
      JSON.stringify({
        fetched_at: new Date().toISOString(),
        region,
        platform: 'Twitter',
        top_insight: topInsight,
        accuracy_notes: accuracyNotes,
        trends: finalTrends,
        raw_count: rawTrends.length,
        supplementary_count: supplementaryCount,
        verified_count: verifiedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fetch-twitter-trends] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', trends: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
