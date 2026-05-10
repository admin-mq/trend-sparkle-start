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
  'Gaming','Culture','Finance','News','Religion','Fashion','Lifestyle','Entrepreneurship',
];

const BATCH_SIZE = 5;
// sonar-pro does deeper per-topic web search. Falls back to sonar if the key
// lacks access — see callPerplexity below.
const PERPLEXITY_MODEL = 'sonar-pro';
const PERPLEXITY_FALLBACK_MODEL = 'sonar';

async function callPerplexity(apiKey: string, payload: any): Promise<Response> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if ((res.status === 400 || res.status === 404) && payload.model !== PERPLEXITY_FALLBACK_MODEL) {
    const errText = await res.text();
    console.warn(`[fetch-twitter-trends] ${payload.model} rejected (${res.status}): ${errText.slice(0, 120)}. Retrying with ${PERPLEXITY_FALLBACK_MODEL}`);
    return callPerplexity(apiKey, { ...payload, model: PERPLEXITY_FALLBACK_MODEL });
  }
  return res;
}

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
// Iterates ALL trend-card__list blocks (newest first in DOM) to get the most
// recent snapshot and enough trends to fill the requested count.
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

  // Match ALL trend-card__list <ol> blocks — trends24 renders newest first in DOM
  const olRegex = /<ol[^>]*class=["']?trend-card__list["']?[^>]*>([\s\S]*?)<\/ol>/g;
  const seen = new Set<string>();
  const trends: string[] = [];
  let olMatch: RegExpExecArray | null;
  let listsFound = 0;

  while ((olMatch = olRegex.exec(html)) !== null) {
    listsFound++;
    // Use matchAll on the captured list content so regex state is isolated per block
    for (const m of olMatch[1].matchAll(/class=["']?trend-link["']?[^>]*>([^<]+)<\/a>/g)) {
      const name = decodeHtmlEntities(m[1].trim());
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        trends.push(name);
      }
    }
    if (trends.length >= count) break;
  }

  if (listsFound === 0) throw new Error('trends24.in structure changed — no trend-card__list found');
  if (trends.length === 0) throw new Error('trends24.in returned no trends for this region');
  console.log(`[fetch-twitter-trends] Scraped ${trends.length} unique trends from ${listsFound} time snapshots:`, trends.slice(0, 5).join(', '));
  return trends.slice(0, count);
}

// ── Fetch category-specific trending topics via Marketers Quest ───────────────────
// trends24.in only surfaces Twitter's native trending list (mostly sports +
// entertainment). Niche categories like Tech/AI/Entrepreneurship rarely crack
// that list. This fills the gap by asking Marketers Quest what's *actually* being
// discussed on X within the user's selected categories right now.
async function fetchCategoryTrends(
  apiKey: string,
  categories: string[],
  region: string,
  today: string,
  targetCount: number = 30
): Promise<string[]> {
  const perCat = Math.ceil(targetCount / categories.length);
  const prompt = `Find the MOST discussed topics on X/Twitter in ${region} today (${today}) within these categories: ${categories.join(', ')}.

Rules:
1. Search X/Twitter and recent news from the last 6 hours
2. Topics must be SPECIFIC — product names, people, events, hashtags, launches, controversies
3. Do NOT return generic terms — be very specific (brand names, designer names, show titles, viral moments)
4. Prioritize what is actively buzzing with tweets RIGHT NOW

Good examples for Fashion: "#OOTD", "Met Gala 2026", "Zara new collection", "Bella Hadid outfit", "#FashionWeek"
Good examples for Lifestyle: "#MorningRoutine", "Stanley Cup trend", "viral wellness hack", "digital nomad visa"
Bad examples: "Fashion", "Lifestyle", "Style", "Trends"

Return ${perCat}-${perCat + 3} topics per category, ${targetCount} total. JSON array of strings only (no markdown):
["topic1", "topic2", ...]`;

  console.log(`[fetch-twitter-trends] Fetching category-specific trends for: ${categories.join(', ')}`);

  try {
    const res = await callPerplexity(apiKey, {
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'system', content: 'You have live X/Twitter web search. Return only JSON arrays of specific topics currently active and buzzing today.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
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
      .slice(0, targetCount);
    console.log(`[fetch-twitter-trends] Got ${filtered.length} category-specific trends:`, filtered.slice(0, 3).join(', '));
    return filtered;
  } catch (err) {
    console.warn('[fetch-twitter-trends] Category trends fetch failed:', err);
    return [];
  }
}

// ── Verify a small batch of trends with focused Marketers Quest search ────────────
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
    const res = await callPerplexity(apiKey, {
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'system', content: 'You verify trending topics using live web search. Search per-topic, focused on news from today/yesterday. Be decisive: if a topic is trending on X, a specific recent reason exists — find it. Avoid over-using "low" confidence.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
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

// ── Fetch niche-specific trends for a creator (when no categories selected) ──
async function fetchNicheTrends(
  apiKey: string,
  niche: string,
  region: string,
  today: string
): Promise<string[]> {
  const prompt = `Find the MOST discussed topics on X/Twitter in ${region} today (${today}) that are relevant to a ${niche} content creator.

Rules:
1. Search X/Twitter and recent news from the last 6 hours
2. Topics must be SPECIFIC — events, hashtags, destinations, people, trends in the ${niche} space
3. Do NOT return generic terms — be specific to what ${niche} audiences are talking about RIGHT NOW
4. Include both niche-specific trends AND broader trending topics a ${niche} creator could engage with

Good examples for Travel: "#VisaOnArrival", "Bali digital nomad visa", "Emirates A380 new route", "solo travel safety tips trending"
Good examples for Fitness: "#75Hard", "new creatine study", "Hyrox London", "running shoe drop"

Return 8-12 topics. JSON array of strings only (no markdown):
["topic1", "topic2", ...]`;

  console.log(`[fetch-twitter-trends] Fetching niche trends for: ${niche} in ${region}`);

  try {
    const res = await callPerplexity(apiKey, {
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'system', content: `You have live X/Twitter web search. You are helping a ${niche} content creator find relevant trending topics. Return only JSON arrays of specific topics currently active and buzzing today.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    if (!res.ok) {
      console.warn(`[fetch-twitter-trends] Niche trends HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const json = extractJson(text);
    const arr = Array.isArray(json) ? json : [];
    const filtered = arr
      .filter((x: any) => typeof x === 'string' && x.length > 0 && x.length < 80)
      .slice(0, 12);
    console.log(`[fetch-twitter-trends] Got ${filtered.length} niche trends for ${niche}:`, filtered.slice(0, 3).join(', '));
    return filtered;
  } catch (err) {
    console.warn('[fetch-twitter-trends] Niche trends fetch failed:', err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { region = 'UK', categories = [], count = 20, user_niche } = await req.json();
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');

    const regionSlug = REGION_SLUGS[region] || 'worldwide';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const todayShort = new Date().toISOString().split('T')[0];

    // ── PASS 1a: Scrape trends24.in ───────────────────────────────────────────
    // When categories are selected, only scrape half from trends24 — the other
    // half will come from niche-specific Perplexity search so results stay relevant.
    const rawCount = categories.length > 0 ? Math.ceil(count / 2) : count;
    let rawTrends: string[];
    try {
      rawTrends = await scrapeTrends24(regionSlug, rawCount);
    } catch (scrapeErr) {
      console.error('[fetch-twitter-trends] Pass 1 scrape failed:', scrapeErr);
      throw new Error(`Failed to fetch trends from trends24.in: ${scrapeErr instanceof Error ? scrapeErr.message : 'unknown'}`);
    }

    // ── PASS 1b: Supplementary niche/category trends ─────────────────────────
    // Priority: manually-selected categories > creator niche > raw trends only
    let combinedTrends = rawTrends;
    let supplementaryCount = 0;
    if (categories.length > 0) {
      // Fetch up to half the total count as niche-specific trends
      const catTarget = Math.ceil(count / 2);
      const catTrends = await fetchCategoryTrends(PERPLEXITY_API_KEY, categories, region, today, catTarget);
      const seen = new Set(rawTrends.map(t => t.toLowerCase()));
      const unique = catTrends.filter(t => !seen.has(t.toLowerCase()));
      supplementaryCount = unique.length;
      // Niche-specific trends lead; raw trends fill remaining slots up to count
      combinedTrends = [...unique, ...rawTrends].slice(0, count);
    } else if (user_niche) {
      // No categories manually chosen — use the creator's niche to surface
      // relevant trends they'd actually want to engage with.
      const nicheTrends = await fetchNicheTrends(PERPLEXITY_API_KEY, user_niche, region, today);
      const seen = new Set(rawTrends.map(t => t.toLowerCase()));
      const unique = nicheTrends.filter(t => !seen.has(t.toLowerCase()));
      supplementaryCount = unique.length;
      combinedTrends = [...unique, ...rawTrends].slice(0, count);
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

    // Sort by relevance: category/niche match → velocity (rising first) → confidence → rank
    const velocityScore = (v: string) => v === 'rising' ? 0 : v === 'stable' ? 1 : 2;
    const confidenceScore = (c: string) => c === 'high' ? 0 : c === 'medium' ? 1 : 2;

    if (categories.length > 0) {
      const prioritySet = new Set((categories as string[]).map(c => c.toLowerCase()));
      finalTrends = finalTrends
        .sort((a: any, b: any) => {
          const aMatch = prioritySet.has((a.category || '').toLowerCase()) ? 0 : 1;
          const bMatch = prioritySet.has((b.category || '').toLowerCase()) ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          const velDiff = velocityScore(a.velocity) - velocityScore(b.velocity);
          if (velDiff !== 0) return velDiff;
          const conDiff = confidenceScore(a.confidence) - confidenceScore(b.confidence);
          if (conDiff !== 0) return conDiff;
          return (a.rank || 99) - (b.rank || 99);
        })
        .map((t: any, i: number) => ({ ...t, rank: i + 1 }));
    } else {
      // No category filter: sort by velocity then confidence to surface freshest trends first
      finalTrends = finalTrends
        .sort((a: any, b: any) => {
          const velDiff = velocityScore(a.velocity) - velocityScore(b.velocity);
          if (velDiff !== 0) return velDiff;
          const conDiff = confidenceScore(a.confidence) - confidenceScore(b.confidence);
          if (conDiff !== 0) return conDiff;
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
