import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Types ──────────────────────────────────────────────────────────────────────
type SignalSource = 'google_trends_uk' | 'google_trends_us' | 'reddit' | 'youtube_uk' | 'youtube_us';
type Timing = 'early' | 'peaking' | 'saturated';

interface RawSignal {
  topic: string;
  source: SignalSource;
  region: 'UK' | 'USA' | 'Global';
  weight: number;       // 1–10
  detail?: string;
}

interface ScoredCandidate {
  topic: string;
  sources: SignalSource[];
  totalScore: number;
  regions: string[];
  details: string[];
}

interface EnrichedCandidate extends ScoredCandidate {
  ig_confirmed: boolean;
  timing: Timing;
  ig_evidence: string;
  virality_score: number;
}

interface IGValidation {
  ig_confirmed: boolean;
  timing: Timing;
  ig_evidence: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1a: Google Trends RSS
// Endpoint: https://trends.google.com/trending/rss?geo=GB|US
// Free, no auth, updates ~hourly. Returns top 20 breakout searches per region.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGoogleTrends(geo: string, region: 'UK' | 'USA'): Promise<RawSignal[]> {
  try {
    const res = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      console.warn(`[fetch-trends] Google Trends ${geo}: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const source: SignalSource = geo === 'GB' ? 'google_trends_uk' : 'google_trends_us';
    const signals: RawSignal[] = [];

    // Parse each <item> block
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const block of itemBlocks.slice(0, 20)) {
      const titleMatch =
        block.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) ||
        block.match(/<title>([^<]+)<\/title>/);
      if (!titleMatch) continue;
      const topic = titleMatch[1].trim();
      if (!topic || topic === 'Google Trends') continue;

      const trafficMatch = block.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/);
      const trafficRaw = (trafficMatch?.[1] || '1000').replace(/[,+\s]/g, '');
      const traffic = parseInt(trafficRaw) || 1000;
      // Log scale weight: 1K→3, 10K→5, 100K→7, 1M→9
      const weight = Math.min(10, Math.max(1, Math.ceil(Math.log10(traffic + 1))));

      signals.push({ topic, source, region, weight });
    }

    console.log(`[fetch-trends] Google Trends ${geo}: ${signals.length} topics`);
    return signals;
  } catch (e) {
    console.warn(`[fetch-trends] Google Trends ${geo} error:`, e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1b: Reddit Hot Posts
// Public .json endpoints — no OAuth needed for GET. Good cultural/news pulse.
// ─────────────────────────────────────────────────────────────────────────────
const REDDIT_FEEDS: { sub: string; region: 'UK' | 'USA' | 'Global' }[] = [
  { sub: 'unitedkingdom', region: 'UK' },
  { sub: 'AskUK',         region: 'UK' },
  { sub: 'ukpolitics',    region: 'UK' },
  { sub: 'news',          region: 'USA' },
  { sub: 'television',    region: 'Global' },
  { sub: 'movies',        region: 'Global' },
  { sub: 'sports',        region: 'Global' },
  { sub: 'entertainment', region: 'Global' },
  { sub: 'Music',         region: 'Global' },
  { sub: 'popheads',      region: 'Global' },
];

// Get Reddit OAuth2 bearer token (client credentials flow — no user needed)
async function getRedditToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const creds = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'User-Agent': 'TrendBot/2.0 (trend analysis; contact: hello@marketers.quest)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) { console.warn('[fetch-trends] Reddit OAuth failed:', res.status); return null; }
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.warn('[fetch-trends] Reddit token error:', e);
    return null;
  }
}

async function fetchRedditSignals(clientId?: string, clientSecret?: string): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // Try OAuth2 first (avoids IP rate-limits on Edge Functions)
  // Falls back to anonymous if credentials not set
  const token = clientId && clientSecret ? await getRedditToken(clientId, clientSecret) : null;
  const baseUrl = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const authHeader = token
    ? { 'Authorization': `Bearer ${token}`, 'User-Agent': 'TrendBot/2.0 (trend analysis; contact: hello@marketers.quest)' }
    : { 'User-Agent': 'TrendBot/2.0 (social trend analysis; contact: hello@marketers.quest)' };

  console.log(`[fetch-trends] Reddit: using ${token ? 'OAuth2' : 'anonymous'} access`);

  for (const feed of REDDIT_FEEDS) {
    try {
      const res = await fetch(
        `${baseUrl}/r/${feed.sub}/hot.json?limit=8&raw_json=1`,
        { headers: authHeader }
      );
      if (!res.ok) {
        console.warn(`[fetch-trends] Reddit r/${feed.sub}: HTTP ${res.status}`);
        await delay(300);
        continue;
      }

      const data = await res.json();
      const posts = data?.data?.children || [];

      for (const post of posts.slice(0, 5)) {
        const p = post.data;
        if (p.stickied || p.over_18 || !p.title) continue;
        const score = p.score || 1;
        const weight = Math.min(10, Math.max(1, Math.ceil(Math.log10(score + 1))));
        signals.push({
          topic: p.title,
          source: 'reddit',
          region: feed.region,
          weight,
          detail: `r/${feed.sub} · ${score.toLocaleString()} upvotes`,
        });
      }
    } catch (e) {
      console.warn(`[fetch-trends] Reddit r/${feed.sub} error:`, e);
    }
    await delay(150);
  }

  console.log(`[fetch-trends] Reddit: ${signals.length} signals`);
  return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1c: YouTube Trending (optional — only runs if YOUTUBE_API_KEY is set)
// Uses YouTube Data API v3 mostPopular chart, regionCode=GB/US
// Free tier: 10,000 units/day. This call costs 1 unit per region.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchYouTubeTrending(apiKey: string): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const regions: [string, 'UK' | 'USA'][] = [['GB', 'UK'], ['US', 'USA']];

  for (const [regionCode, region] of regions) {
    try {
      const url =
        `https://www.googleapis.com/youtube/v3/videos` +
        `?part=snippet,statistics&chart=mostPopular` +
        `&regionCode=${regionCode}&maxResults=10&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[fetch-trends] YouTube ${regionCode}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();

      for (const item of (data.items || [])) {
        const views = parseInt(item.statistics?.viewCount || '0');
        // Normalize down: YouTube videos have 10M+ views normally
        const weight = Math.min(8, Math.max(1, Math.ceil(Math.log10(views + 1)) - 2));
        const source: SignalSource = regionCode === 'GB' ? 'youtube_uk' : 'youtube_us';
        signals.push({
          topic: item.snippet.title,
          source,
          region,
          weight,
          detail: `YouTube trending · ${item.snippet.channelTitle}`,
        });
      }
    } catch (e) {
      console.warn(`[fetch-trends] YouTube ${regionCode} error:`, e);
    }
  }

  console.log(`[fetch-trends] YouTube: ${signals.length} signals`);
  return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2a: Keyword extraction + cross-source deduplication
// Groups semantically similar topics, sums weights, applies source-count bonus.
// ─────────────────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'is','are','was','were','have','has','had','will','would','could','should',
  'this','that','what','which','who','how','why','when','where','its','after',
  'about','says','over','more','from','just','than','not','they','their','been',
  'also','into','here','new','first','last','year','week','day','days','amid',
  'amid','gets','sees','show','shows','back','take','takes','make','makes',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function topicsOverlap(a: string, b: string): boolean {
  const kwA = new Set(extractKeywords(a));
  const kwB = extractKeywords(b);
  if (kwA.size === 0 || kwB.length === 0) return false;
  const shared = kwB.filter(k => kwA.has(k)).length;
  // Overlap if ≥1 shared keyword AND shared fraction ≥ 35%
  return shared >= 1 && shared / Math.min(kwA.size, kwB.length) >= 0.35;
}

function deduplicateAndScore(signals: RawSignal[]): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];

  for (const signal of signals) {
    if (extractKeywords(signal.topic).length === 0) continue;

    const existing = candidates.find(c => topicsOverlap(c.topic, signal.topic));
    if (existing) {
      if (!existing.sources.includes(signal.source)) existing.sources.push(signal.source);
      existing.totalScore += signal.weight;
      if (!existing.regions.includes(signal.region)) existing.regions.push(signal.region);
      if (signal.detail) existing.details.push(signal.detail);
      // Prefer shorter/cleaner topic name (Google Trends gives clean names)
      if (signal.source.startsWith('google_trends') || signal.topic.length < existing.topic.length) {
        existing.topic = signal.topic;
      }
    } else {
      candidates.push({
        topic: signal.topic,
        sources: [signal.source],
        totalScore: signal.weight,
        regions: [signal.region],
        details: signal.detail ? [signal.detail] : [],
      });
    }
  }

  // Cross-source bonus: multiply score by unique source count
  // (a trend confirmed by 3 sources beats one from 1 source by 3×)
  return candidates
    .map(c => ({ ...c, totalScore: c.totalScore * c.sources.length }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2b: Instagram aggregator validation via OpenAI web search
// Checks whether top IG aggregators (@ladbible, @pubity, @unilad, etc.)
// have already posted about the trend. Determines timing signal.
//
// TIMING KEY:
//   early     → GT spiking, <5 IG posts → brand posts NOW, 6-12h head start
//   peaking   → 5-20 IG posts, still spreading → act fast
//   saturated → 20+ posts, everywhere → only if brand has unique angle
// ─────────────────────────────────────────────────────────────────────────────
async function validateOnInstagram(
  topics: string[],
  openaiKey: string,
): Promise<Map<string, IGValidation>> {
  const resultMap = new Map<string, IGValidation>();
  if (topics.length === 0) return resultMap;

  const prompt = `You have web search access. For each topic below, search Instagram and social aggregator accounts to determine if content about it has been posted yet.

Key accounts to check: @ladbible, @pubity, @unilad, @theshaderoom, @worldstar, @barstoolsports, @bbcnews, @complex, @hypebeast, @9gag

Topics to validate: ${topics.slice(0, 15).join(' | ')}

For each topic classify timing:
• "early"     = topic is spiking in search but Instagram has almost nothing yet (0-3 posts from aggregators) — this is the most valuable, brand posts NOW
• "peaking"   = 4-20 posts on Instagram, trend is spreading — act fast
• "saturated" = 20+ posts, everyone's covering it — generally skip unless brand has unique angle

Return ONLY valid JSON:
{
  "validations": {
    "exact topic name": {
      "ig_confirmed": true,
      "timing": "early",
      "ig_evidence": "One sentence describing what you found on Instagram."
    }
  }
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: prompt,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.output
        ?.find((o: any) => o.type === 'message')
        ?.content?.find((c: any) => c.type === 'output_text')
        ?.text ?? '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [topic, v] of Object.entries(parsed.validations || {})) {
          resultMap.set(topic.toLowerCase(), v as IGValidation);
        }
        console.log(`[fetch-trends] IG validation: ${resultMap.size}/${topics.length} topics confirmed`);
      }
    }
  } catch (e) {
    console.warn('[fetch-trends] IG validation error:', e);
  }

  // Default fallback for any topics not returned
  for (const t of topics) {
    if (!resultMap.has(t.toLowerCase())) {
      resultMap.set(t.toLowerCase(), { ig_confirmed: false, timing: 'peaking', ig_evidence: 'Not found in search' });
    }
  }

  return resultMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIRALITY SCORE CALCULATION
// Combines cross-source signal strength with timing bonus
// ─────────────────────────────────────────────────────────────────────────────
function calcViralityScore(
  candidate: ScoredCandidate,
  maxScore: number,
  timing: Timing,
): number {
  const baseNorm = Math.min(70, Math.round((candidate.totalScore / (maxScore || 1)) * 60));
  const sourceBonus = Math.min(20, candidate.sources.length * 6);    // +6 per unique source
  const regionBonus = candidate.regions.length >= 2 ? 10 : 0;       // UK+USA = broader reach
  const timingBonus = timing === 'early' ? 15 : timing === 'peaking' ? 5 : -15;
  return Math.max(10, Math.min(99, baseNorm + sourceBonus + regionBonus + timingBonus));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY')!;
    const YOUTUBE_API_KEY     = Deno.env.get('YOUTUBE_API_KEY') || '';
    const REDDIT_CLIENT_ID    = Deno.env.get('REDDIT_CLIENT_ID') || '';
    const REDDIT_CLIENT_SECRET = Deno.env.get('REDDIT_CLIENT_SECRET') || '';
    const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY   = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const today = new Date().toISOString().split('T')[0];

    console.log(`[fetch-trends] ── Starting 3-layer pipeline for ${today} ──`);
    if (!YOUTUBE_API_KEY) console.log('[fetch-trends] YOUTUBE_API_KEY not set — skipping YouTube layer');
    if (!REDDIT_CLIENT_ID) console.log('[fetch-trends] REDDIT_CLIENT_ID not set — using anonymous Reddit access');

    // ── LAYER 1: Multi-source discovery (all in parallel) ─────────────────
    console.log('[fetch-trends] Layer 1: Fetching signals from all sources...');
    const [gtUK, gtUS, redditSignals, ytSignals] = await Promise.all([
      fetchGoogleTrends('GB', 'UK'),
      fetchGoogleTrends('US', 'USA'),
      fetchRedditSignals(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET),
      YOUTUBE_API_KEY ? fetchYouTubeTrending(YOUTUBE_API_KEY) : Promise.resolve([]),
    ]);

    const allSignals: RawSignal[] = [...gtUK, ...gtUS, ...redditSignals, ...ytSignals];
    const sourceBreakdown = {
      google_trends_uk: gtUK.length,
      google_trends_us: gtUS.length,
      reddit: redditSignals.length,
      youtube: ytSignals.length,
      total: allSignals.length,
    };
    console.log('[fetch-trends] Layer 1 complete:', sourceBreakdown);

    if (allSignals.length < 5) {
      throw new Error(`Insufficient signals (only ${allSignals.length}). Check network access from Edge Function.`);
    }

    // ── LAYER 2a: Deduplicate + score ──────────────────────────────────────
    const candidates = deduplicateAndScore(allSignals);
    console.log(`[fetch-trends] Layer 2a: ${candidates.length} candidates after dedup`);
    console.log('[fetch-trends] Top 10:', candidates.slice(0, 10).map(c => `"${c.topic}" (${c.sources.join('+')})`).join(', '));

    // ── LAYER 2b: Instagram aggregator validation ──────────────────────────
    console.log('[fetch-trends] Layer 2b: Running IG aggregator validation...');
    const topTopics = candidates.slice(0, 15).map(c => c.topic);
    const igValidations = await validateOnInstagram(topTopics, OPENAI_API_KEY);

    // Build enriched candidates with timing + virality score
    const maxScore = candidates[0]?.totalScore || 1;
    const enriched: EnrichedCandidate[] = candidates.slice(0, 15).map(c => {
      const igData = igValidations.get(c.topic.toLowerCase()) ||
        { ig_confirmed: false, timing: 'peaking' as Timing, ig_evidence: '' };
      return {
        ...c,
        ig_confirmed: igData.ig_confirmed,
        timing: igData.timing,
        ig_evidence: igData.ig_evidence,
        virality_score: calcViralityScore(c, maxScore, igData.timing),
      };
    });

    // Sort: early first (most valuable for brands), then by virality score
    enriched.sort((a, b) => {
      const timingOrder: Record<Timing, number> = { early: 0, peaking: 1, saturated: 2 };
      if (timingOrder[a.timing] !== timingOrder[b.timing]) {
        return timingOrder[a.timing] - timingOrder[b.timing];
      }
      return b.virality_score - a.virality_score;
    });

    const earlyCount = enriched.filter(c => c.timing === 'early').length;
    console.log(`[fetch-trends] Layer 2b complete — ${earlyCount} EARLY signals detected`);

    // Build research summary for GPT (rich context with timing signals)
    const researchSummary = enriched.map(c => {
      const timingTag = c.timing === 'early' ? '🟢 EARLY' : c.timing === 'peaking' ? '🟡 PEAKING' : '🔴 SATURATED';
      return [
        `${timingTag} | "${c.topic}"`,
        `  Sources: ${c.sources.join(' + ')} | Regions: ${c.regions.join('/')} | Virality: ${c.virality_score}`,
        `  IG: ${c.ig_confirmed ? '✓ confirmed' : '✗ not yet'} — ${c.ig_evidence || 'n/a'}`,
        `  Context: ${c.details.slice(0, 2).join('; ') || 'no extra detail'}`,
      ].join('\n');
    }).join('\n\n');

    // ── LAYER 3: GPT-4o-mini — structure signals into final trend entries ──
    console.log('[fetch-trends] Layer 3: Structuring with GPT-4o-mini...');

    const signalCount = enriched.length;
    const structurePrompt = `You are a UK/USA social media trend analyst. Below is live multi-source trend signal data captured right now (${today}).

⚠️ CRITICAL RULES:
1. ONLY create entries for topics in the LIVE SIGNALS below — never invent from training data
2. SKIP any topic that is purely a sports score/result/stats lookup with no social media angle (e.g. "racing results", "cricket scores", "league table"). Only keep sports topics if they involve a personality, drama, controversy, or cultural moment that people would actually create content about.
3. SKIP generic search terms with no clear viral angle (e.g. "fast results", "dynamic pricing")
4. For remaining topics, assess: would people actually make Instagram/TikTok content about this? If yes, include it. If it's just an information search, skip it.
5. Quality over quantity — it's better to return 8 strong trends than 15 weak ones.

TIMING SIGNAL KEY:
🟢 EARLY     = Trending in search/news but almost no Instagram posts yet. Brand posts NOW gets 6-12h head start.
🟡 PEAKING   = Spreading across Instagram, still room to ride the wave. Act fast.
🔴 SATURATED = Everywhere already. Only surface if brand has a genuinely fresh angle.

LIVE SIGNALS (${signalCount} topics — your ONLY source material):
${researchSummary}

Your task: Filter to only the social-media-viable topics, then create one trend entry per kept topic.
- Use your knowledge to add cultural context and explain WHY this is trending RIGHT NOW
- Write 3-5 sentence descriptions: what triggered it, what people are posting, the emotional hook
- For EARLY trends, note the timing advantage in the description
- source_signals must exactly match the sources listed in each signal

Return ONLY valid JSON:
{
  "trends": [
    {
      "trend_name": "Specific descriptive name (2-5 words)",
      "hashtag": "primaryhashtag",
      "extra_hashtags": "#tag1 #tag2 #tag3 #tag4",
      "views_last_60h_millions": 14.0,
      "description": "3-5 sentences explaining what it is, why it's trending now, what people are posting, and the emotional hook.",
      "region": "UK",
      "premium_only": false,
      "timing": "early",
      "ig_confirmed": false,
      "virality_score": 87,
      "source_signals": ["google_trends_uk", "reddit"],
      "category": "Entertainment"
    }
  ]
}

Rules:
- hashtag = lowercase, no # symbol, no spaces
- region = UK | USA | Global
- category = exactly one of: Entertainment | Sports | Music | Tech | News | Fashion | Food | Gaming | Finance | Lifestyle
- Order: early first, then peaking, then saturated — within each group sort by virality_score desc
- NEVER add a trend not in the signal list above`;

    const structureRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: structurePrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!structureRes.ok) throw new Error(`GPT structure call failed: ${structureRes.status}`);
    const structureData = await structureRes.json();
    const parsed = JSON.parse(structureData.choices[0].message.content);
    // Filter out any hallucinated trends (no source_signals = GPT invented it)
    const trends: any[] = (parsed.trends || []).filter((t: any) =>
      Array.isArray(t.source_signals) && t.source_signals.length > 0
    );
    const hallucinated = (parsed.trends || []).length - trends.length;
    if (hallucinated > 0) console.warn(`[fetch-trends] Dropped ${hallucinated} hallucinated trends (no source_signals)`);
    console.log(`[fetch-trends] Layer 3: ${trends.length} real trends structured`);

    // ── Upsert to trends table ─────────────────────────────────────────────
    let upserted = 0, errors = 0;

    for (const trend of trends) {
      const slug = trend.trend_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 28);
      const trend_id = `TQ-${today}-${slug}`;
      const hashtags = `#${trend.hashtag} ${(trend.extra_hashtags || '').trim()}`.trim();

      const { error } = await supabase.from('trends').upsert(
        {
          trend_id,
          trend_name:              trend.trend_name,
          description:             trend.description,
          hashtags,
          views_last_60h_millions: trend.views_last_60h_millions,
          region:                  trend.region || 'Global',
          premium_only:            trend.premium_only ?? false,
          active:                  true,
          date_added:              today,
          // New signal fields
          timing:                  trend.timing || 'peaking',
          ig_confirmed:            trend.ig_confirmed ?? false,
          virality_score:          trend.virality_score ?? 50,
          source_signals:          trend.source_signals || [],
          category:                trend.category || 'Entertainment',
        },
        { onConflict: 'trend_id', ignoreDuplicates: false }
      );

      if (error) { console.error(`[fetch-trends] Upsert error ${trend_id}:`, error); errors++; }
      else upserted++;
    }

    // ── Deactivate trends older than 7 days ───────────────────────────────
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    await supabase
      .from('trends')
      .update({ active: false })
      .lt('date_added', cutoff.toISOString().split('T')[0])
      .eq('active', true);

    const result = {
      success: true,
      date: today,
      pipeline: '3-layer: google-trends + reddit + youtube + ig-validation',
      source_breakdown: sourceBreakdown,
      candidates_after_dedup: candidates.length,
      early_signals: earlyCount,
      trends_upserted: upserted,
      errors,
    };
    console.log('[fetch-trends] ── Done ──', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[fetch-trends] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
