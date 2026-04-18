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

// ── Robust JSON extractor ────────────────────────────────────────────────────
function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  // Try full parse first
  try { return JSON.parse(cleaned); } catch {}
  // Try extracting first {...} or [...] block
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

  // Grab the FIRST <ol class=trend-card__list>...</ol> block (most recent snapshot)
  const olMatch = html.match(/<ol[^>]*class=["']?trend-card__list["']?[^>]*>([\s\S]*?)<\/ol>/);
  if (!olMatch) throw new Error('trends24.in structure changed — no trend-card__list found');

  // Extract all trend-link inner text
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

// ── Fallback: minimal response using raw trends only ─────────────────────────
function buildFallback(rawTrends: string[], region: string): any {
  return {
    fetched_at: new Date().toISOString(),
    region,
    platform: 'Twitter',
    top_insight: 'Verification unavailable — showing raw trending topics. Click any trend for live context.',
    accuracy_notes: 'Verification step failed. Context will be fetched when you generate tweets.',
    trends: rawTrends.map((name, i) => ({
      rank: i + 1,
      name,
      category: 'News',
      velocity: 'stable',
      freshness_hours: 0,
      why_trending: 'Reason unverified — click "Generate tweets" for live context',
      confidence: 'low',
      marketer_signal: null,
    })),
  };
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

    // ── PASS 1: Direct HTML scrape of trends24.in ─────────────────────────────
    let rawTrends: string[];
    try {
      rawTrends = await scrapeTrends24(regionSlug, count);
    } catch (scrapeErr) {
      console.error('[fetch-twitter-trends] Pass 1 scrape failed:', scrapeErr);
      throw new Error(`Failed to fetch trends from trends24.in: ${scrapeErr instanceof Error ? scrapeErr.message : 'unknown'}`);
    }

    // ── PASS 2: Perplexity sonar verifies each trend ──────────────────────────
    console.log(`[fetch-twitter-trends] Pass 2 — verifying ${rawTrends.length} trends via Perplexity sonar`);

    const priorityLine = categories.length > 0
      ? `\nSORT ORDER: Put trends in these categories FIRST (in the returned array): ${(categories as string[]).join(', ')}. Other trends follow after. Do NOT drop any trends — classify them all.`
      : '';

    const p2Prompt = `Today is ${today}. You are verifying why topics are trending on X/Twitter in ${region}.

STRICT ANTI-HALLUCINATION RULES:
1. For each trend below, search "[trend] news ${todayShort}" to find why it is trending TODAY
2. NEVER assume a trend is about a holiday/date without a news article from TODAY confirming it
3. NEVER infer why a celebrity/person is trending without finding a specific article from TODAY
4. If no confirmed reason found: set confidence="low" and why_trending="Reason unverified after search"
5. Be honest — confidence="high" means you found a direct news article from today or yesterday

TRENDS TO VERIFY (from trends24.in/${regionSlug}):
${rawTrends.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${priorityLine}

Classify velocity based on how long you estimate it has been trending:
- "rising"  = appeared in last 2 hours (breaking news, just posted)
- "stable"  = trending 2–6 hours
- "fading"  = trending more than 6 hours

Available categories: ${ALL_CATEGORIES.join(' | ')}

Return ALL ${rawTrends.length} trends. Return ONLY valid JSON (no markdown, no explanation):
{
  "fetched_at": "${new Date().toISOString()}",
  "region": "${region}",
  "platform": "Twitter",
  "top_insight": "One actionable marketer insight based only on verified high-confidence trends (1 sentence)",
  "accuracy_notes": "Brief note on scan quality",
  "trends": [
    {
      "rank": 1,
      "name": "exact trend name from the list above",
      "category": "one category from the list",
      "velocity": "rising | stable | fading",
      "freshness_hours": 2,
      "why_trending": "Verified reason, max 15 words. Or: Reason unverified after search",
      "confidence": "high | medium | low",
      "marketer_signal": "Actionable brand opportunity, max 12 words. null if confidence=low"
    }
  ]
}`;

    let verified: any = null;
    try {
      const p2Res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a trend verification agent with live web search. Your job is to find out WHY topics are trending right now using real news sources. Return only valid JSON.',
            },
            { role: 'user', content: p2Prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!p2Res.ok) {
        const errText = await p2Res.text();
        console.error(`[fetch-twitter-trends] Pass 2 HTTP ${p2Res.status}: ${errText.slice(0, 300)}`);
      } else {
        const p2Data = await p2Res.json();
        const p2Text = p2Data.choices?.[0]?.message?.content ?? '';
        console.log(`[fetch-twitter-trends] Pass 2 returned ${p2Text.length} chars`);
        verified = extractJson(p2Text);
        if (!verified) console.warn(`[fetch-twitter-trends] Pass 2 JSON parse failed. Raw: ${p2Text.slice(0, 300)}`);
      }
    } catch (p2Err) {
      console.error('[fetch-twitter-trends] Pass 2 fetch error:', p2Err);
    }

    // ── If Pass 2 failed, return fallback with raw trends ─────────────────────
    if (!verified || !Array.isArray(verified.trends) || verified.trends.length === 0) {
      console.warn('[fetch-twitter-trends] Pass 2 produced no usable trends — using fallback');
      const fallback = buildFallback(rawTrends, region);
      return new Response(
        JSON.stringify({ ...fallback, raw_count: rawTrends.length, verified_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalTrends = verified.trends;

    // If selected categories, SORT by category match (don't filter) so priority
    // categories appear first but all trends are still visible.
    if (categories.length > 0) {
      const prioritySet = new Set((categories as string[]).map(c => c.toLowerCase()));
      finalTrends = [...finalTrends].sort((a: any, b: any) => {
        const aMatch = prioritySet.has((a.category || '').toLowerCase()) ? 0 : 1;
        const bMatch = prioritySet.has((b.category || '').toLowerCase()) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return (a.rank || 99) - (b.rank || 99);
      });
      // Re-rank so displayed numbers match new order
      finalTrends = finalTrends.map((t: any, i: number) => ({ ...t, rank: i + 1 }));
    }

    console.log(`[fetch-twitter-trends] Done — ${finalTrends.length} verified trends returned`);

    return new Response(
      JSON.stringify({
        ...verified,
        trends: finalTrends,
        raw_count: rawTrends.length,
        verified_count: finalTrends.length,
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
