import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_SUPABASE_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbm5wZHJldmJraGJoendjY3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTg3ODQsImV4cCI6MjA3OTk3NDc4NH0.WKuei-3pR2TphEKjSOOhvNlECrX93Jt9NE5SK2TcD-M";

const SYSTEM_PROMPT = `You are an elite hashtag strategy engine specialized in Instagram content distribution (2026 algorithms).

INSTAGRAM 2026 ALGORITHM REALITY:
- Hashtags are content classification signals, not primary discovery drivers
- The interest-graph determines distribution; hashtags help the algorithm categorize content into the right clusters
- 3–5 highly precise hashtags significantly outperform 20+ generic ones (confirmed behavior)
- Hashtags that contradict the visual/audio content are penalized by Instagram's multimodal AI
- Reels distribution is interest-graph based; hashtags improve Explore placement and hashtag page reach
- Classification strength (how clearly a hashtag identifies the content) matters more than volume popularity

YOUR TASK:
Analyze the post idea and return the optimal 3–5 hashtag portfolio. Think like a strategist, not a generator.

SCORING MODEL (weights sum to 100%):
1. Relevance (25%): Semantic match to actual content. Most important dimension. If weak, the tag should almost never be selected regardless of trend status.
2. Audience Match (17%): Attracts the RIGHT audience for this creator's goal, not just any audience. #fitness attracts broadly but weakly; #beginnerfatlossjourney attracts precisely.
3. Trend Velocity (12%): Current momentum on the platform and in the niche. Cap this — trendiness must never override relevance.
4. Competition Efficiency (10%): Opportunity ratio. Not too saturated (dominated by large accounts), not too empty (no audience browsing it). Reward efficient opportunity.
5. Format Fit (8%): Works for this specific content format (reel, carousel, tutorial, etc.).
6. Platform Fit (8%): Native Instagram classification strength. Split: classification_strength (55%) + discovery_surface_match (45%). Discovery surfaces: Explore, hashtag page, interest feed.
7. Region Fit (6%): Relevant in the specified target region. Include region-specific tags when geographic audience is clear.
8. Intent Match (6%): Reinforces the content's primary intent (discovery, education, inspiration, entertainment, shopping, community). Hashtags should clarify intent, not blur it.
9. Historical Performance (6%): Estimated success likelihood based on patterns for similar content, niche, and region.
10. Freshness (2%): Recently active — hashtag is alive and seeing current posts.

PENALTIES (subtract from raw score before returning final score):
- Redundancy penalty (-15 each): Multiple hashtags with essentially the same semantic meaning
- Overbroad penalty (-30): Tags like #love, #viral, #trending, #fyp, #instagood, #content — no diagnostic value
- Misalignment penalty (-20): Trending but semantically weak for this specific content
- Spam risk penalty (-40, usually exclude entirely): Overused/banned/low-trust tags

PORTFOLIO STRUCTURE (the final set must have role diversity):
- 1 "Category Anchor" — broad topic classification that helps algorithm understand the content category
- 1 "Audience Signal" — precise targeting of the intended viewer profile
- 1 "Niche Discovery" — specific to this exact content, highest intent match
- 1 "Trend Expansion" OR "Geo Relevance" — situational: use Trend Expansion if strong trend context, Geo Relevance if regional audience is important
- 1 optional 5th tag: "Buyer Intent" for sales-focused posts, extra "Niche Discovery" for community, "Trend Expansion" for reach

SET-LEVEL RULES:
- No more than 1 weakly relevant trend tag
- No more than 1 overly broad category tag
- At least 3 distinct semantic roles
- If commercial post, include 1 buyer-intent tag when appropriate
- Penalize sets where 3+ hashtags mean essentially the same thing

CONFIDENCE CALIBRATION (be honest):
- "high": Strong semantic clarity, clear niche, good audience signal, region identified
- "moderate": Some ambiguity in niche, audience, or region; limited trend data
- "experimental": Broad or unclear content, niche too vague, or unusual combination

DISTRIBUTION READINESS (honest input-quality signals, NOT outcome predictions):
- topic_clarity: One sharp sentence about how clear the topic signal is for the algorithm
- audience_precision: 1–5 integer (5 = extremely precise audience targeting, 1 = very broad)
- saturation_exposure: "Low" | "Moderate" | "High" (overall risk of this set being buried by large accounts)
- intent_coherence: "Matched" | "Mixed" | "Fragmented" (does the set reinforce one clear intent, or dilute it?)

EXPLANATION QUALITY:
Each explanation must be specific to THIS post, not generic. Say WHY this tag serves this exact content.
Bad: "Popular fitness hashtag with good reach"
Good: "Precise match for beginner home workout content — filters in the right audience without competing against gym brands"

Return ONLY valid JSON matching this exact schema:
{
  "set_score": number (0–100, overall portfolio quality score),
  "confidence_level": "high" | "moderate" | "experimental",
  "distribution_readiness": {
    "topic_clarity": string,
    "audience_precision": number (1–5),
    "saturation_exposure": "Low" | "Moderate" | "High",
    "intent_coherence": "Matched" | "Mixed" | "Fragmented"
  },
  "hashtags": [
    {
      "tag": string (with # prefix, lowercase),
      "score": number (0–100, after penalties),
      "role": "Category Anchor" | "Audience Signal" | "Niche Discovery" | "Trend Expansion" | "Geo Relevance" | "Buyer Intent",
      "explanation": string (one sharp sentence — specific to this post, not generic),
      "subscores": {
        "relevance": number (0–100),
        "audience_match": number (0–100),
        "trend_velocity": number (0–100),
        "competition_efficiency": number (0–100),
        "platform_fit": number (0–100)
      },
      "alternatives": [
        { "tag": string, "type": "safer", "reason": string },
        { "tag": string, "type": "niche", "reason": string }
      ]
    }
  ],
  "why_this_works": string (2–3 sentences — specific portfolio logic: what role each tag plays and why the combination works together),
  "best_posting_time": string (specific time window for this niche and region, e.g. "6:30 PM – 8:30 PM local time — peak scroll window for this audience"),
  "caption_keywords": string[] (3–5 words or short phrases to include in the caption body to reinforce the hashtag signals for Instagram's NLP),
  "warnings": string[] (0–3 important caveats; empty array if none — only include if genuinely important)
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      caption,
      content_description,
      platform = 'instagram',
      region = 'global',
      goal_type = 'reach',
      brand_profile,
      from_trend_quest,
      user_id,
    } = await req.json();

    if (!caption?.trim()) {
      return new Response(
        JSON.stringify({ error: 'caption is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If coming from Trend Quest, fetch the trend data for extra context
    let trendHashtags = '';
    let trendContext = '';
    if (from_trend_quest?.trend_id) {
      try {
        const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
        const { data: trendData } = await externalSupabase
          .from('trends')
          .select('trend_name, hashtags, description')
          .eq('trend_id', from_trend_quest.trend_id)
          .maybeSingle();

        if (trendData) {
          trendHashtags = trendData.hashtags || '';
          trendContext = `This content is riding the trend "${trendData.trend_name}". Trend context: ${(trendData.description || '').substring(0, 250)}`;
        }
      } catch (err) {
        console.warn('Could not fetch trend context:', err);
      }
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    // Build user message
    const userMessage = [
      `Platform: ${platform}`,
      `Region: ${region}`,
      `Goal: ${goal_type}`,
      brand_profile?.brand_name
        ? `Brand: ${brand_profile.brand_name}${brand_profile.industry ? ` (${brand_profile.industry})` : ''}${brand_profile.audience ? ` — audience: ${brand_profile.audience}` : ''}${brand_profile.geography ? ` — based in ${brand_profile.geography}` : ''}`
        : null,
      trendContext ? `\nTrend context: ${trendContext}` : null,
      trendHashtags ? `Trend-associated hashtags to consider as candidates: ${trendHashtags}` : null,
      from_trend_quest?.idea_title ? `Content idea: "${from_trend_quest.idea_title}"` : null,
      `\nPost idea / caption:\n"${caption.trim()}"`,
      content_description ? `\nAdditional context: ${content_description}` : null,
    ].filter(Boolean).join('\n');

    console.log('Calling OpenAI for hashtag analysis. Platform:', platform, 'Region:', region, 'Goal:', goal_type);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.35, // Low temp for consistent, reasoned scoring
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} — ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content returned from OpenAI');

    const result = JSON.parse(content);
    console.log('Analysis complete. Set score:', result.set_score, 'Confidence:', result.confidence_level, 'Tags:', result.hashtags?.length);

    // Persist to main DB for authenticated users
    let requestId: string | null = null;
    if (user_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseServiceKey) {
          const mainSupabase = createClient(supabaseUrl, supabaseServiceKey);

          const { data: requestRow } = await mainSupabase
            .from('hashtag_requests')
            .insert({
              user_id,
              brand_name: brand_profile?.brand_name || null,
              platform,
              region,
              caption: caption.trim(),
              content_description: content_description || null,
              goal_type,
              from_trend_quest: from_trend_quest || null,
            })
            .select('id')
            .single();

          if (requestRow?.id) {
            requestId = requestRow.id;
            await mainSupabase
              .from('hashtag_results')
              .insert({
                request_id: requestId,
                set_score: result.set_score,
                confidence_level: result.confidence_level,
                distribution_readiness: result.distribution_readiness,
                hashtags: result.hashtags,
                why_this_works: result.why_this_works,
                best_posting_time: result.best_posting_time,
                caption_keywords: result.caption_keywords,
                warnings: result.warnings,
              });
          }
        }
      } catch (dbErr) {
        // Non-fatal — still return the result even if DB save fails
        console.warn('DB save failed (non-fatal):', dbErr);
      }
    }

    return new Response(
      JSON.stringify({ ...result, request_id: requestId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-hashtags:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
