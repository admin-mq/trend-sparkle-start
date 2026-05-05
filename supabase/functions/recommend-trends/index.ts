import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase credentials.
// Prefer explicit EXTERNAL_SUPABASE_* env vars (for cross-project setups
// where the trends DB lives in a different project from the edge functions).
// Otherwise fall back to the auto-injected SUPABASE_URL / SUPABASE_ANON_KEY
// that every Supabase Edge Function gets for free (same-project lookups).
// Never hardcode keys in source — they leak via git, Lovable previews, and
// the deployed function bundle. Anyone with read access to this repo would
// have full anon-key access to the trends DB.
const EXTERNAL_SUPABASE_URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const EXTERNAL_SUPABASE_ANON_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.error("[recommend-trends] Missing Supabase credentials. Set EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_ANON_KEY or rely on auto-injected SUPABASE_URL/SUPABASE_ANON_KEY.");
}

// Tier 3 / Fix #1 — Observation history for sparklines.
//
// Fetches up to 14 days of time-series observations for the specified
// trend_ids in a single round-trip, then groups them by trend_id and
// caps each list at the 14 most recent. The UI uses this to render an
// inline sparkline; insufficient history (<2 points) renders nothing.
//
// Honesty rule: we ORDER BY observed_at ASC so the consumer reads
// chronologically. The UI must NOT extrapolate beyond the latest
// observation — what we have is what we show.
type Observation = {
  observed_at: string;
  virality_score: number | null;
  corroboration_score: number | null;
  timing: string | null;
  ig_validated: string | null;
  yt_view_count: number | null;
  yt_like_count: number | null;
  yt_comment_count: number | null;
};

async function fetchObservationHistory(
  supabase: any,
  trendIds: string[],
  daysBack = 14,
): Promise<Map<string, Observation[]>> {
  const map = new Map<string, Observation[]>();
  if (trendIds.length === 0) return map;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const { data, error } = await supabase
    .from('trend_observations')
    .select('trend_id, observed_at, virality_score, corroboration_score, timing, ig_validated, yt_view_count, yt_like_count, yt_comment_count')
    .in('trend_id', trendIds)
    .gte('observed_at', cutoff.toISOString())
    .order('observed_at', { ascending: true })
    .limit(500);
  if (error) {
    // Don't break recommendations on a sparkline-data fetch failure —
    // surface the error and return an empty map so the UI just hides
    // sparklines for this response. This is degraded, not broken.
    console.warn('[recommend-trends] Observation history fetch error:', error);
    return map;
  }
  for (const row of (data || [])) {
    const obs: Observation = {
      observed_at:         row.observed_at,
      virality_score:      row.virality_score,
      corroboration_score: row.corroboration_score,
      timing:              row.timing,
      ig_validated:        row.ig_validated,
      yt_view_count:       row.yt_view_count,
      yt_like_count:       row.yt_like_count,
      yt_comment_count:    row.yt_comment_count,
    };
    const list = map.get(row.trend_id) || [];
    list.push(obs);
    map.set(row.trend_id, list);
  }
  // Cap each trend's history at the 14 most recent observations. Already
  // sorted ASC by observed_at, so slice from the end.
  for (const [k, list] of map) {
    if (list.length > 14) map.set(k, list.slice(-14));
  }
  return map;
}

// Tier 3 / Fix #2 — Competitor coverage signal.
//
// Goal: tell users whether their TRACKED competitors have already posted
// about a trend, vs nobody in their watchlist has touched it yet (a true
// "first-mover window"). The only ground-truth signal we have today is
// YouTube — fetch-trends captures `yt_top_publishers` (up to 5 distinct
// channels with recent videos on the trend) per trend row. We intersect
// those publishers against the user's `profile.competitors` array.
//
// Honesty rules (mirrors the contract in the migration comment):
//   • yt_top_publishers === null → "couldn't check". UI must render this
//     as ambiguous, never as a positive first-mover claim.
//   • yt_top_publishers === [] (empty)  → real "no one on YouTube" signal.
//     Surface as "first-mover on YouTube — your tracked competitors
//     haven't posted yet". The "on YouTube" qualifier is mandatory.
//   • yt_top_publishers has items, none match → first-mover signal still
//     valid: a non-competitor channel posted, but none of *your tracked*
//     competitors have. Same first-mover copy.
//   • yt_top_publishers has items, some match → "X covered" badge with
//     the matched competitor names + links to their videos.
//
// We do NOT claim coverage on platforms we can't check (IG, TikTok,
// LinkedIn). The badge copy is platform-explicit so the user knows to
// verify elsewhere themselves.
type Competitor = {
  name: string;
  domain?: string;
  type?: string;
  why_relevant?: string;
  is_aspirational?: boolean;
};

type YouTubePublisher = {
  channel_id: string;
  channel_title: string;
  video_id: string;
  video_title: string;
  published_at: string;
};

type CompetitorMatch = {
  competitor_name: string;
  publisher: YouTubePublisher;
};

type CompetitorCoverage = {
  /** Which platform's data backed this verdict. Always 'YouTube' today. */
  checked_platform: 'YouTube';
  /**
   * What we found. NULL = couldn't check (no API key, search error).
   * UI MUST render NULL as ambiguous — never as first-mover.
   */
  publishers: YouTubePublisher[] | null;
  /** Tracked competitors that we matched in `publishers`. May be empty. */
  matches: CompetitorMatch[];
  /**
   * Tracked competitors that we LOOKED FOR but didn't find on this trend's
   * publisher list. We surface this in the badge tooltip so the user can
   * see exactly which competitors we checked — transparency over magic.
   */
  unmatched_competitors: string[];
};

/**
 * Normalize a string for fuzzy comparison: lowercase, strip non-alpha,
 * collapse whitespace. We compare normalized competitor names against
 * normalized channel titles using substring containment in BOTH directions
 * — "Nike" matches a channel called "Nike Football" and a competitor
 * called "Nike Football" matches a channel "Nike". We intentionally do
 * NOT do token-level matching (e.g. "Sports" alone shouldn't match every
 * sports brand) — substring is conservative and avoids false positives.
 */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Domains often look like "nike.com" or "www.shopify.co.uk". Strip
 * subdomain + TLD to get a comparable brand token.
 */
function domainBrandToken(domain: string | undefined): string | null {
  if (!domain) return null;
  const cleaned = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const firstLabel = cleaned.split('/')[0].split('.')[0];
  return firstLabel.length >= 3 ? normalizeName(firstLabel) : null;
}

function computeCompetitorCoverage(
  publishers: YouTubePublisher[] | null,
  competitors: Competitor[],
): CompetitorCoverage {
  // No competitors configured → no badge to render. Return an empty
  // shell so the UI's null check still works without special-casing.
  if (!Array.isArray(competitors) || competitors.length === 0) {
    return { checked_platform: 'YouTube', publishers, matches: [], unmatched_competitors: [] };
  }

  if (publishers === null) {
    // We genuinely couldn't check — preserve the null and report no
    // matches. UI MUST treat publishers===null as ambiguous.
    return {
      checked_platform: 'YouTube',
      publishers: null,
      matches: [],
      unmatched_competitors: competitors.map(c => c.name),
    };
  }

  const matches: CompetitorMatch[] = [];
  const unmatched: string[] = [];
  for (const competitor of competitors) {
    const nameTokens: string[] = [];
    const normName = normalizeName(competitor.name || '');
    if (normName.length >= 3) nameTokens.push(normName);
    const domainToken = domainBrandToken(competitor.domain);
    if (domainToken && !nameTokens.includes(domainToken)) nameTokens.push(domainToken);
    if (nameTokens.length === 0) {
      unmatched.push(competitor.name);
      continue;
    }

    let matched: YouTubePublisher | null = null;
    for (const pub of publishers) {
      const normChannel = normalizeName(pub.channel_title || '');
      if (!normChannel) continue;
      // Substring containment in either direction. Conservative — see
      // the normalizeName() docstring for why we don't do token splits.
      if (nameTokens.some(t => normChannel.includes(t) || t.includes(normChannel))) {
        matched = pub;
        break;
      }
    }
    if (matched) {
      matches.push({ competitor_name: competitor.name, publisher: matched });
    } else {
      unmatched.push(competitor.name);
    }
  }

  return {
    checked_platform: 'YouTube',
    publishers,
    matches,
    unmatched_competitors: unmatched,
  };
}

type BrandMemory = {
  user_id: string | null;
  brand_name: string;
  business_summary?: string | null;
  voice_profile_text?: string | null;
  do_list?: string[] | null;
  dont_list?: string[] | null;
  preferred_formats?: string[] | null;
  tone_preferences?: any | null;
};

async function getBrandMemory(
  supabase: any,
  userId: string | null,
  brandName: string
): Promise<BrandMemory | null> {
  if (userId) {
    const { data: userMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("brand_name", brandName)
      .maybeSingle();

    if (userMemory) return userMemory;

    const { data: sharedMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .is("user_id", null)
      .eq("brand_name", brandName)
      .maybeSingle();

    return sharedMemory;
  }

  const { data } = await supabase
    .from("brand_memory")
    .select("*")
    .is("user_id", null)
    .eq("brand_name", brandName)
    .maybeSingle();

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_profile, user_id, selected_categories } = await req.json();
    console.log('Received user_profile:', user_profile, 'user_id:', user_id || 'anonymous', 'categories:', selected_categories || 'all');

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize EXTERNAL Supabase client (user's project with trends data)
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);

    // Fetch brand memory
    const userId = user_id || null;
    const brandName = user_profile.brand_name || "Unknown Brand";
    const brandMemory = await getBrandMemory(externalSupabase, userId, brandName);
    console.log('Brand memory:', brandMemory ? 'found' : 'not found');

    // Fetch candidate trends from external Supabase (optionally filtered by category)
    const categories: string[] = Array.isArray(selected_categories) && selected_categories.length > 0
      ? selected_categories
      : [];

    // We deliberately do NOT select views_last_60h_millions here — we don't
    // currently have a real view-count signal source, so that field is always
    // NULL. Asking the LLM to optimise for it is meaningless. We rank by
    // virality_score (computed from cross-source corroboration + timing)
    // and let brand-fit be the LLM's job.
    let query = externalSupabase
      .from('trends')
      .select('trend_id, trend_name, description, hashtags, region, premium_only, active, timing, ig_confirmed, ig_validated, virality_score, source_signals, corroboration_score, first_seen_at, last_seen_at, peaked_at, peak_virality_score, category, yt_video_id, yt_video_title, yt_channel_title, yt_view_count, yt_like_count, yt_comment_count, yt_video_published_at, yt_fetched_at, yt_top_publishers')
      .eq('premium_only', false)
      .eq('active', true)
      .order('virality_score', { ascending: false })
      .limit(30);

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data: trends, error: trendsError } = await query;

    if (trendsError) {
      console.error('External Supabase error:', trendsError);
      throw new Error('Failed to fetch trends from external database');
    }

    if (!trends || trends.length === 0) {
      console.log('No trends found');
      return new Response(
        JSON.stringify({ recommended_trends: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${trends.length} candidate trends from external Supabase`);

    // Try to get Marketers Quest recommendations
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Lock in the 2 highest-virality trends so the LLM can't drop them
      // for a marginal "brand fit" pick. Virality_score is computed from
      // cross-source corroboration + timing in fetch-trends — not the
      // (always-NULL) views_last_60h_millions placeholder we used to use.
      const top2TrendIds = trends.slice(0, 2).map(t => t.trend_id);

      const systemPrompt = `You are a senior social media strategist for high-growth creators and brands.

Your job:
- Read a brand profile.
- Read a list of current social media trends. Each one comes with:
  - a description of WHY it is trending right now,
  - a virality_score (10–99) reflecting cross-source corroboration + timing,
  - a timing label (early / peaking / saturated),
  - source_signals (which raw signals confirmed it: google_trends_uk, reddit, youtube_us, etc.),
  - a corroboration_score (1–3) — the count of DISTINCT platforms (Google Trends / Reddit / YouTube) that confirmed it. 3 = all three platforms agree (highest credibility), 1 = only one platform (treat as weaker signal),
  - optional yt_view_count / yt_like_count — REAL YouTube engagement on the best-matching recent video for this trend. When present, this is externally-verifiable proof that audiences are actually engaging (not just searching). When null, it just means we couldn't find a qualifying recent video — treat it as "no extra evidence", NOT as "this trend has no reach".
  - a category and region.
- Pick exactly 5 trends that will perform best for this brand.

Brand memory is provided as a style guide. Use it as the highest priority for voice and tone:
- Match the rhythm and attitude described in voice_profile_text.
- Follow do_list and avoid dont_list.
- If tone_preferences exist, use primary_tones and intensity_preference as extra guidance together with the current tone and tone_intensity controls.

Tone handling:
- The brand tone may include multiple styles (tones array). Use primary_tone as the main voice.
- Use tone_intensity (1–5) to control how strongly the tone is expressed:
  1–2 mild, 3 balanced, 4–5 strong, bold, creator-grade.
- If primary_tone is 'Naughty', allow premium A-rated innuendo but keep it non-explicit and brand-safe.

Rules:
- ALWAYS include the 2 trends with the highest virality_score in the final 5 (these are the strongest signals available right now).
- For the other 3:
  - Optimise for brand fit (industry, niche, audience, tone, content_format, primary_goal).
  - Prefer trends with timing="early" when brand can move fast — first-mover advantage.
  - Prefer trends with corroboration_score ≥ 2. A single-platform trend (corroboration_score=1) can be a real trend or just one platform's noise — only pick it if the brand fit is unusually strong AND the description's WHY is concrete and verifiable.
  - When yt_view_count is present, factor it in as proof of real reach (e.g., 1M+ views = strong external validation). Cite the specific number in why_good_fit when it materially supports the pick. Never claim engagement we don't have — if yt_view_count is null, do NOT invent a number or imply YouTube has zero reach.
  - Skip saturated trends unless the brand has a genuinely fresh angle.
- Use the description field: reference specific triggers (leaks, finales, controversies, emotional themes, flashmobs, etc.), not generic statements.
- Avoid clichés like:
  - 'engaging content'
  - 'resonates with your audience'
  - 'leveraging this trend'
  - 'drive engagement'.
- Write like a human creative partner, not a corporate strategist.

For each selected trend you must return:
- trend_id (matching one from the input),
- why_good_fit (2–3 punchy sentences using brand language and the real reasons the trend is hot — cite a specific moment from the description, never a generic claim),
- example_hook (ONE scroll-stopping hook line, max ~140 characters, which can start with an emoji or CAPS),
- angle_summary (1–2 sentences describing the creative angle, not a repeat of why_good_fit).

Always respond with a single valid JSON object.`;

      const trendsForPrompt = trends.map(t => ({
        trend_id: t.trend_id,
        trend_name: t.trend_name,
        description: t.description || '',
        hashtags: t.hashtags || '',
        virality_score: t.virality_score ?? null,
        timing: t.timing || null,
        source_signals: t.source_signals || [],
        corroboration_score: t.corroboration_score ?? 1,
        // Real YouTube engagement evidence (Tier 2 / Fix #6). Null when no
        // qualifying match was found — the LLM is instructed to treat null
        // as "no extra evidence", never as "zero reach".
        yt_view_count: (t as any).yt_view_count ?? null,
        yt_like_count: (t as any).yt_like_count ?? null,
        yt_channel_title: (t as any).yt_channel_title ?? null,
        category: t.category || null,
        region: t.region || null,
      }));

      const userMessage = `
Here is the brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the brand memory (style guide):
${JSON.stringify(brandMemory, null, 2)}

Here is the list of candidate trends (ranked by virality_score, with descriptions of why they are currently viral):
${JSON.stringify(trendsForPrompt, null, 2)}

The 2 trends with the highest virality_score are: ${top2TrendIds.join(', ')} — you MUST include these.

Please select exactly 5 trends and return a JSON object like:

{
  "recommended_trends": [
    {
      "trend_id": "T001",
      "why_good_fit": "2–3 punchy sentences.",
      "example_hook": "One scroll-stopping hook line, max ~140 characters.",
      "angle_summary": "1–2 sentences describing the creative angle."
    }
  ]
}

Focus on very concrete reasons this trend works for this specific brand. Do NOT use generic marketing buzzwords.
`;

      console.log('Calling Marketers Quest API...');
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('Marketers Quest API error:', openaiResponse.status, errorText);
        throw new Error(`Marketers Quest API call failed: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in Marketers Quest response');
      }

      console.log('Marketers Quest response received, parsing...');
      const parsedResponse = JSON.parse(content);

      // Build a map for quick trend lookup
      const trendMap = new Map();
      trends.forEach(t => trendMap.set(t.trend_id, t));

      // Tier 3 / Fix #1 — fetch observation history ONLY for the trends
      // the LLM picked, not all 30 candidates. Single round trip.
      const pickedTrendIds: string[] = (parsedResponse.recommended_trends || [])
        .map((r: any) => r.trend_id)
        .filter((id: any): id is string => typeof id === 'string');
      const observationHistoryMap = await fetchObservationHistory(externalSupabase, pickedTrendIds);

      // Tier 3 / Fix #2 — competitor coverage. Compute per-trend, using
      // the user's profile.competitors list (may be empty/undefined).
      const userCompetitors: Competitor[] = Array.isArray(user_profile?.competitors)
        ? user_profile.competitors
        : [];

      // Map Marketers Quest recommendations to full trend objects
      const recommended_trends = parsedResponse.recommended_trends
        .map((rec: any) => {
          const fullTrend = trendMap.get(rec.trend_id);
          if (!fullTrend) {
            console.warn(`Trend ${rec.trend_id} not found in database`);
            return null;
          }
          // yt_top_publishers comes back as JSONB (object/array) or null.
          // Pass through the null distinction so computeCompetitorCoverage
          // can return its honest "couldn't check" verdict.
          const rawPublishers = (fullTrend as any).yt_top_publishers;
          const publishers: YouTubePublisher[] | null = rawPublishers === null || rawPublishers === undefined
            ? null
            : (Array.isArray(rawPublishers) ? rawPublishers : []);
          const competitor_coverage = computeCompetitorCoverage(publishers, userCompetitors);
          return {
            trend_id: fullTrend.trend_id,
            trend_name: fullTrend.trend_name,
            // views_last_60h_millions intentionally omitted — we no longer fake it.
            region: fullTrend.region || null,
            timing: fullTrend.timing || 'peaking',
            ig_confirmed: fullTrend.ig_confirmed ?? null,
            ig_validated: fullTrend.ig_validated ?? 'unknown',
            virality_score: fullTrend.virality_score ?? null,
            source_signals: fullTrend.source_signals || [],
            corroboration_score: fullTrend.corroboration_score ?? 1,
            // Lifecycle history. peaked_at can be NULL (no observed peak
            // drop yet), and that's intentional — UI must distinguish
            // "still climbing" (NULL) from "peaked Xh ago" (timestamp).
            first_seen_at: fullTrend.first_seen_at ?? null,
            last_seen_at: fullTrend.last_seen_at ?? null,
            peaked_at: fullTrend.peaked_at ?? null,
            peak_virality_score: fullTrend.peak_virality_score ?? null,
            // Real YouTube engagement evidence. All null when no qualifying
            // match was found — UI MUST hide the engagement badge entirely
            // in that case (showing "0 views" would be a fabrication).
            yt_video_id: (fullTrend as any).yt_video_id ?? null,
            yt_video_title: (fullTrend as any).yt_video_title ?? null,
            yt_channel_title: (fullTrend as any).yt_channel_title ?? null,
            yt_view_count: (fullTrend as any).yt_view_count ?? null,
            yt_like_count: (fullTrend as any).yt_like_count ?? null,
            yt_comment_count: (fullTrend as any).yt_comment_count ?? null,
            yt_video_published_at: (fullTrend as any).yt_video_published_at ?? null,
            yt_fetched_at: (fullTrend as any).yt_fetched_at ?? null,
            // Time-series observation history (Tier 3 / Fix #1). Up to 14
            // most recent observations, ascending by observed_at. UI MUST
            // hide the sparkline if length < 2.
            observation_history: observationHistoryMap.get(fullTrend.trend_id) || [],
            // Tier 3 / Fix #2 — competitor coverage. publishers===null
            // means we couldn't check; UI MUST render that as ambiguous
            // and never as a positive first-mover claim.
            competitor_coverage,
            category: fullTrend.category || null,
            why_good_fit: rec.why_good_fit || '',
            example_hook: rec.example_hook || '',
            angle_summary: rec.angle_summary || ''
          };
        })
        .filter(Boolean);

      console.log(`Returning ${recommended_trends.length} AI-powered recommendations`);
      return new Response(
        JSON.stringify({ recommended_trends }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Honest fallback when OpenAI is down or rate-limited.
      //
      // Old fallback returned 5× "This is a strong fit because it is a
      // high-attention global trend" — generic boilerplate that destroys
      // trust on the first outage.
      //
      // New fallback uses the trend's actual stored description (which we
      // already have, sourced from real signals) plus the timing/category
      // signal to produce a meaningful why_good_fit per trend. We also
      // surface the degraded mode to the client so the UI can label it
      // honestly ("Live AI ranking unavailable — showing top trends by
      // signal strength").
      console.error('AI recommendation failed, using signal-only fallback:', aiError);

      const firstSentence = (text: string | null | undefined): string => {
        if (!text) return '';
        const trimmed = text.trim();
        const m = trimmed.match(/^[^.!?]+[.!?]/);
        return (m ? m[0] : trimmed.slice(0, 220)).trim();
      };

      const timingPhrase = (t: string | null | undefined): string => {
        if (t === 'early') return 'Early signal — Instagram aggregators have not posted yet, so first-mover advantage is still on the table';
        if (t === 'peaking') return 'Peaking right now — still room to ride the wave but speed matters';
        if (t === 'saturated') return 'Already widespread — only worth posting with a genuinely fresh angle';
        return 'Currently in active rotation across multiple platforms';
      };

      // Same observation-history fetch as the AI path — keep parity so
      // sparklines render in the degraded mode too.
      const fallbackTrendIds = trends.slice(0, 5).map(t => t.trend_id);
      const observationHistoryMap = await fetchObservationHistory(externalSupabase, fallbackTrendIds);

      // Tier 3 / Fix #2 — competitor coverage. Same intent as AI path.
      const userCompetitors: Competitor[] = Array.isArray(user_profile?.competitors)
        ? user_profile.competitors
        : [];

      const fallbackTrends = trends.slice(0, 5).map(trend => {
        const description = (trend as any).description || '';
        const timing = (trend as any).timing || null;
        const sources: string[] = (trend as any).source_signals || [];
        const corroboration: number = (trend as any).corroboration_score ?? 1;
        const category = (trend as any).category || null;

        const ytViews: number | null = (trend as any).yt_view_count ?? null;
        const ytLikes: number | null = (trend as any).yt_like_count ?? null;

        // Same null/array discrimination as the AI path — preserve the
        // null distinction so "couldn't check" stays distinct from
        // "checked, found zero".
        const rawPublishers = (trend as any).yt_top_publishers;
        const publishers: YouTubePublisher[] | null = rawPublishers === null || rawPublishers === undefined
          ? null
          : (Array.isArray(rawPublishers) ? rawPublishers : []);
        const competitor_coverage = computeCompetitorCoverage(publishers, userCompetitors);

        const lead = firstSentence(description) ||
          `${trend.trend_name} is currently active${category ? ` in the ${category} space` : ''}.`;
        const signalLine = corroboration >= 2
          ? `Confirmed across ${corroboration} distinct platforms (${sources.slice(0, 3).join(', ')}).`
          : sources.length > 0
            ? `Single-platform signal so far (${sources[0]}) — verify before posting.`
            : `Surfaced from cross-source aggregation.`;
        // Only mention YouTube reach when we actually have a number. NULL =
        // we couldn't find a qualifying match; we will not fabricate or
        // imply the trend has no reach.
        const ytLine = ytViews !== null
          ? ` Recent YouTube uploads on this topic are pulling ${ytViews.toLocaleString()} views${ytLikes !== null ? ` / ${ytLikes.toLocaleString()} likes` : ''}.`
          : '';

        return {
          trend_id: trend.trend_id,
          trend_name: trend.trend_name,
          region: (trend as any).region || null,
          timing,
          ig_confirmed: (trend as any).ig_confirmed ?? null,
          ig_validated: (trend as any).ig_validated ?? 'unknown',
          virality_score: (trend as any).virality_score ?? null,
          source_signals: sources,
          corroboration_score: corroboration,
          first_seen_at: (trend as any).first_seen_at ?? null,
          last_seen_at: (trend as any).last_seen_at ?? null,
          peaked_at: (trend as any).peaked_at ?? null,
          peak_virality_score: (trend as any).peak_virality_score ?? null,
          yt_video_id: (trend as any).yt_video_id ?? null,
          yt_video_title: (trend as any).yt_video_title ?? null,
          yt_channel_title: (trend as any).yt_channel_title ?? null,
          yt_view_count: ytViews,
          yt_like_count: ytLikes,
          yt_comment_count: (trend as any).yt_comment_count ?? null,
          yt_video_published_at: (trend as any).yt_video_published_at ?? null,
          yt_fetched_at: (trend as any).yt_fetched_at ?? null,
          observation_history: observationHistoryMap.get(trend.trend_id) || [],
          competitor_coverage,
          category,
          why_good_fit: `${lead} ${timingPhrase(timing)}. ${signalLine}${ytLine}`.trim(),
          example_hook: `${trend.trend_name}${category ? ` × ${user_profile.brand_name}` : ''} — here's the angle nobody's posted yet.`,
          angle_summary: `Tie ${trend.trend_name} into ${user_profile.brand_name}'s ${user_profile.niche || user_profile.industry || 'core message'} by leading with the specific moment driving the trend (see description), then bridging to the brand's POV.`,
        };
      });

      return new Response(
        JSON.stringify({
          recommended_trends: fallbackTrends,
          degraded: true,
          degraded_reason: 'ai_ranking_unavailable',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in recommend-trends function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', recommended_trends: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
