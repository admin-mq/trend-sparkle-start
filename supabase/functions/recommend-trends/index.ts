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
      .select('trend_id, trend_name, description, hashtags, region, premium_only, active, timing, ig_confirmed, ig_validated, virality_score, source_signals, category')
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
  - source_signals (which platforms confirmed it: google_trends_uk, reddit, youtube_us, etc. — more sources = more real),
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
  - Prefer trends with 2+ source_signals — multi-source corroboration means it's actually trending, not a one-platform blip.
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

      // Map Marketers Quest recommendations to full trend objects
      const recommended_trends = parsedResponse.recommended_trends
        .map((rec: any) => {
          const fullTrend = trendMap.get(rec.trend_id);
          if (!fullTrend) {
            console.warn(`Trend ${rec.trend_id} not found in database`);
            return null;
          }
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

      const fallbackTrends = trends.slice(0, 5).map(trend => {
        const description = (trend as any).description || '';
        const timing = (trend as any).timing || null;
        const sources: string[] = (trend as any).source_signals || [];
        const category = (trend as any).category || null;

        const lead = firstSentence(description) ||
          `${trend.trend_name} is currently active${category ? ` in the ${category} space` : ''}.`;
        const signalLine = sources.length > 0
          ? `Confirmed across ${sources.length} live signal${sources.length === 1 ? '' : 's'} (${sources.slice(0, 3).join(', ')}).`
          : `Surfaced from cross-source aggregation.`;

        return {
          trend_id: trend.trend_id,
          trend_name: trend.trend_name,
          region: (trend as any).region || null,
          timing,
          ig_confirmed: (trend as any).ig_confirmed ?? null,
          ig_validated: (trend as any).ig_validated ?? 'unknown',
          virality_score: (trend as any).virality_score ?? null,
          source_signals: sources,
          category,
          why_good_fit: `${lead} ${timingPhrase(timing)}. ${signalLine}`.trim(),
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
