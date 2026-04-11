import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_SUPABASE_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbm5wZHJldmJraGJoendjY3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTg3ODQsImV4cCI6MjA3OTk3NDc4NH0.WKuei-3pR2TphEKjSOOhvNlECrX93Jt9NE5SK2TcD-M";

const HASHTAG_ITEM_SCHEMA = `{
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
  }
}`;

const SYSTEM_PROMPT = `You are an elite hashtag strategy engine specialized in Instagram content distribution (2026 algorithms).

INSTAGRAM 2026 ALGORITHM REALITY:
- Hashtags are content classification signals, not primary discovery drivers
- The interest-graph determines distribution; hashtags help categorize content into the right clusters
- 3–5 precise hashtags significantly outperform 20+ generic ones (confirmed behavior)
- Hashtags that contradict the visual/audio content are penalized by Instagram's multimodal AI
- Reels distribution is interest-graph based; hashtags improve Explore placement and hashtag page reach
- Classification strength matters more than volume popularity

YOUR TASK:
Return THREE things for the same post: a Safe hashtag set, an Experimental hashtag set, and a Content Positioning analysis.

═══════════════════════════════════════════════
PART 1 & 2 — HASHTAG SETS
═══════════════════════════════════════════════

SCORING MODEL (weights sum to 100%):
1. Relevance (25%): Semantic match to actual content. If weak, almost never select regardless of trend status.
2. Audience Match (17%): Attracts the RIGHT viewer, not just any viewer.
3. Trend Velocity (12%): Current niche momentum. Capped — never overrides relevance.
4. Competition Efficiency (10%): Opportunity ratio. Reward efficient discovery windows.
5. Format Fit (8%): Works for this specific content format.
6. Platform Fit (8%): classification_strength (55%) + discovery_surface_match (45%).
7. Region Fit (6%): Relevant in the specified market.
8. Intent Match (6%): Reinforces the content's primary intent — never blurs it.
9. Historical Performance (6%): Estimated success for similar content + niche + region.
10. Freshness (2%): Tag is alive and seeing current posts.

PENALTIES:
- Redundancy (-15 each): Multiple tags with the same semantic meaning
- Overbroad (-30): #love, #viral, #trending, #fyp, #instagood — no diagnostic value
- Misalignment (-20): Trending but semantically weak for this content
- Spam risk (-40, usually exclude): Overused/banned/low-trust tags

SAFE SET rules:
- Maximise relevance and audience precision above all else
- Prefer well-established hashtags with proven engagement density in this niche
- Prioritise low saturation risk — smaller accounts can still rank here
- Conservative trend exposure: only include a trend tag if relevance score ≥ 80
- All 3–5 tags must score ≥ 70 after penalties
- set_type: "safe" | set_label: "Safe Reach"
- set_description: one sentence — what this set is optimised for

EXPERIMENTAL SET rules:
- Accept slightly lower relevance scores in exchange for higher trend velocity or broader reach
- Include at least one hashtag with higher trend velocity that the safe set avoids
- May include one emerging or niche-crossing tag that has upside but less certainty
- Target a wider potential reach at the cost of some precision
- At least 3 of the 5 tags must still score ≥ 65 after penalties
- set_type: "experimental" | set_label: "Experimental Reach"
- set_description: one sentence — the higher-upside bet this set is making

CRITICAL: The two sets must be meaningfully different.
- At most 2 overlapping tags between Safe and Experimental
- They should represent genuinely different distribution strategies

PORTFOLIO STRUCTURE (apply to each set):
- 1 Category Anchor, 1 Audience Signal, 1 Niche Discovery
- 1 Trend Expansion OR Geo Relevance (situational)
- 1 optional 5th: Buyer Intent / extra Niche Discovery / Trend Expansion

CONFIDENCE: "high" | "moderate" | "experimental"
DISTRIBUTION READINESS per set:
- topic_clarity: one sharp sentence
- audience_precision: 1–5
- saturation_exposure: "Low" | "Moderate" | "High"
- intent_coherence: "Matched" | "Mixed" | "Fragmented"

═══════════════════════════════════════════════
PART 3 — CONTENT POSITIONING ANALYSIS
═══════════════════════════════════════════════

Analyse the semantic alignment between the post's hook tone and every hashtag's intent signal.
This is separate from hashtag scoring — it is a diagnostic layer on top of both sets.

HOOK TONE CLASSIFICATION (pick the dominant one):
- "Educational" — teaches, explains, gives tips or how-to
- "Inspirational" — motivates, uplifts, aspirational narrative
- "Entertaining" — humour, storytelling, POV, relatable content
- "Sales / Promotional" — offer, CTA, product push, urgency
- "Community" — conversation starter, shared identity, polls, relatable struggle
- "News / Commentary" — trend reaction, opinion, industry take
- "Personal / Narrative" — day-in-life, behind-the-scenes, personal story

CONTENT INTENT (what action the algorithm should drive):
discovery | education | inspiration | entertainment | shopping | community | awareness

MISMATCH DETECTION RULES — flag a mismatch when:
- A hashtag's audience primarily expects DIFFERENT content than what this post delivers
  Examples:
  · Educational hook + #aesthetic / #vibes → entertainment/lifestyle intent clash
  · Sales hook + #selfcare / #wellness → trust signal dilution (community hashtags signal no-sell zones)
  · Personal/narrative hook + #howto / #tips → educational signal contradiction
  · Entertainment hook + #businesstips / #entrepreneurship → intent audience mismatch
  · Inspirational hook + buyer-intent hashtags → premature conversion pressure
- A hashtag is present in BOTH sets but misaligned in BOTH — flag as present_in: "both"
- Only flag genuine mismatches. If the sets are well-aligned, mismatches array should be empty.

SEVERITY:
- "high": Directly contradicts the content intent — algorithm receives actively confused classification
- "medium": Adjacent but not aligned — adds noise to classification signal
- "low": Subtle drift — worth noting but not harmful

POSITIONING SCORE (0–100):
- 90–100: Full coherence — hashtags and content tone are reinforcing the same intent cluster
- 70–89: Minor drift — 1 tag slightly misaligned, overall signal clear
- 50–69: Mixed signal — hashtag set and content tone pulling in different directions
- Below 50: Significant mismatch — algorithm will likely misclassify this content

OVERALL VERDICT:
- "aligned": Score ≥ 80 and zero high-severity mismatches
- "minor_drift": Score 60–79, or 1–2 low/medium mismatches
- "significant_mismatch": Score < 60, or any high-severity mismatch

SPECIFICITY RULES — every field must be specific to THIS post:
- conflict: name the exact semantic clash, not a generic description
- fix: give an actual replacement hashtag or specific caption/framing change
- recommendation: reference the hook tone and the specific mismatch pattern detected
- caption_tone_tips: short phrases that bridge the detected gap — NOT hashtags, NOT generic advice

═══════════════════════════════════════════════
FULL JSON SCHEMA
═══════════════════════════════════════════════

Return ONLY valid JSON:
{
  "safe": {
    "set_type": "safe",
    "set_label": "Safe Reach",
    "set_description": string,
    "set_score": number (0–100),
    "confidence_level": "high" | "moderate" | "experimental",
    "distribution_readiness": {
      "topic_clarity": string,
      "audience_precision": number (1–5),
      "saturation_exposure": "Low" | "Moderate" | "High",
      "intent_coherence": "Matched" | "Mixed" | "Fragmented"
    },
    "hashtags": [${HASHTAG_ITEM_SCHEMA}],
    "why_this_works": string,
    "best_posting_time": string,
    "caption_keywords": string[],
    "warnings": string[]
  },
  "experimental": {
    "set_type": "experimental",
    "set_label": "Experimental Reach",
    "set_description": string,
    "set_score": number (0–100),
    "confidence_level": "high" | "moderate" | "experimental",
    "distribution_readiness": {
      "topic_clarity": string,
      "audience_precision": number (1–5),
      "saturation_exposure": "Low" | "Moderate" | "High",
      "intent_coherence": "Matched" | "Mixed" | "Fragmented"
    },
    "hashtags": [${HASHTAG_ITEM_SCHEMA}],
    "why_this_works": string,
    "best_posting_time": string,
    "caption_keywords": string[],
    "warnings": string[]
  },
  "positioning": {
    "hook_tone": string (one of the 7 tones above),
    "detected_content_intent": string (one of: discovery | education | inspiration | entertainment | shopping | community | awareness),
    "positioning_score": number (0–100),
    "overall_verdict": "aligned" | "minor_drift" | "significant_mismatch",
    "mismatches": [
      {
        "hashtag": string (with # prefix),
        "present_in": "safe" | "experimental" | "both",
        "conflict": string (one sharp sentence — the exact semantic clash for THIS post),
        "severity": "high" | "medium" | "low",
        "fix": string (one actionable sentence — actual replacement or specific framing change)
      }
    ],
    "recommendation": string (1–2 sentences — most important positioning action, specific to this post),
    "caption_tone_tips": string[] (2–3 short phrases to include in the caption to close the detected gap — NOT hashtags)
  }
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

    // Fetch trend context if coming from Trend Quest
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

    console.log('Calling OpenAI for hashtag + positioning analysis. Platform:', platform, 'Region:', region, 'Goal:', goal_type);

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
        temperature: 0.4,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} — ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content returned from OpenAI');

    const parsed         = JSON.parse(content);
    const safeSet        = parsed.safe;
    const experimentalSet = parsed.experimental;
    const positioning    = parsed.positioning ?? null;

    console.log(
      'Analysis complete. Safe:', safeSet?.set_score,
      'Experimental:', experimentalSet?.set_score,
      'Positioning:', positioning?.positioning_score,
      'Verdict:', positioning?.overall_verdict,
      'Mismatches:', positioning?.mismatches?.length ?? 0,
    );

    // Persist to DB for authenticated users
    let requestId: string | null = null;
    if (user_id) {
      try {
        const supabaseUrl        = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseServiceKey) {
          const mainSupabase = createClient(supabaseUrl, supabaseServiceKey);

          const { data: requestRow } = await mainSupabase
            .from('hashtag_requests')
            .insert({
              user_id,
              brand_name:          brand_profile?.brand_name || null,
              platform,
              region,
              caption:             caption.trim(),
              content_description: content_description || null,
              goal_type,
              from_trend_quest:    from_trend_quest || null,
            })
            .select('id')
            .single();

          if (requestRow?.id) {
            requestId = requestRow.id;
            await mainSupabase
              .from('hashtag_results')
              .insert({
                request_id:             requestId,
                set_score:              safeSet.set_score,
                confidence_level:       safeSet.confidence_level,
                distribution_readiness: safeSet.distribution_readiness,
                hashtags:               { safe: safeSet.hashtags, experimental: experimentalSet.hashtags },
                why_this_works:         safeSet.why_this_works,
                best_posting_time:      safeSet.best_posting_time,
                caption_keywords:       safeSet.caption_keywords,
                warnings:               safeSet.warnings,
              });
          }
        }
      } catch (dbErr) {
        console.warn('DB save failed (non-fatal):', dbErr);
      }
    }

    return new Response(
      JSON.stringify({ safe: safeSet, experimental: experimentalSet, positioning, request_id: requestId }),
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
