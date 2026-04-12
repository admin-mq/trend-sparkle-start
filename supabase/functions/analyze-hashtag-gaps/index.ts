import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a hashtag portfolio strategist for Instagram (2026).

Your task: compare a competitor's / niche's hashtag list against the user's own historical portfolio and surface actionable gaps.

═══════════════════════════════════════════════
DEFINITIONS
═══════════════════════════════════════════════

GAPS — competitor uses these; user doesn't. Evaluate adoption opportunity.
USER_EDGE — user uses these; competitor doesn't. Determine if these are differentiators or blind spots.
COMMON_GROUND — both use. Confirms baseline overlap.

═══════════════════════════════════════════════
GAP TAG ASSESSMENT
═══════════════════════════════════════════════

For each GAP tag assess:

opportunity_score (0–100):
- 80–100: High-value gap — clear audience or reach benefit the user is missing
- 60–79: Moderate opportunity — worth testing with the right content
- 40–59: Marginal — situational upside, proceed with caution
- 0–39: Low value for this user — skip

risk: "low" | "medium" | "high"
- low: relevant, healthy competition window, low saturation relative to reach
- medium: moderately relevant OR moderate saturation OR audience fit uncertainty
- high: semantic mismatch OR oversaturated OR attracts wrong audience for this user's niche

reason: one sharp sentence — what SPECIFIC audience or reach benefit does adopting this unlock?
(Reference the user's niche context if provided. Not generic "this tag has good engagement".)

verdict: "adopt" | "test" | "skip"
- adopt: opportunity_score ≥ 70 AND risk is low or medium
- test: opportunity_score 45–69 OR risk is medium
- skip: opportunity_score < 45 OR risk is high

═══════════════════════════════════════════════
USER EDGE TAG ASSESSMENT
═══════════════════════════════════════════════

type: "differentiator" | "blind_spot" | "niche_specific"
- differentiator: user reaches an audience the competitor misses — worth protecting and doubling down
- blind_spot: user uses this tag but it's likely adding noise or attracting misaligned audience vs the competitor's cleaner strategy
- niche_specific: legitimate content focus difference, not a competitive signal either way

note: one sentence — what does this mean for the user's competitive position?

═══════════════════════════════════════════════
OVERLAP STRENGTH
═══════════════════════════════════════════════

overlap_strength: "strong" | "moderate" | "weak"
- strong: ≥ 60% of competitor tags already appear in user portfolio
- moderate: 30–59% overlap
- weak: < 30% overlap (user is missing significant coverage of this niche's baseline)

═══════════════════════════════════════════════
STRATEGY SUMMARY & ACTIONS
═══════════════════════════════════════════════

strategy_summary: 2–3 sentences. Must reference the specific gap pattern detected — the niche cluster the user is missing, or the positioning mismatch, or the overlap strength. Not generic advice.

top_actions: exactly 3 strings. Start each with an action verb. Concrete and specific to what you found — not "post more consistently".

═══════════════════════════════════════════════
OUTPUT SCHEMA (return ONLY valid JSON)
═══════════════════════════════════════════════

{
  "gaps": [
    {
      "tag": string (with # prefix),
      "opportunity_score": number (0–100),
      "risk": "low" | "medium" | "high",
      "reason": string,
      "verdict": "adopt" | "test" | "skip"
    }
  ],
  "user_edge": [
    {
      "tag": string (with # prefix),
      "type": "differentiator" | "blind_spot" | "niche_specific",
      "note": string
    }
  ],
  "common_ground": string[],
  "overlap_strength": "strong" | "moderate" | "weak",
  "strategy_summary": string,
  "top_actions": string[]
}

Sort gaps by opportunity_score descending.
Sort user_edge: differentiators first, then blind_spots, then niche_specific.
If user portfolio is empty, assess gaps purely on niche/platform context and note the lack of comparison data in strategy_summary.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      competitor_tags,
      user_portfolio = [],
      niche_context,
      platform = 'instagram',
      region = 'global',
    } = await req.json();

    if (!Array.isArray(competitor_tags) || competitor_tags.length === 0) {
      return new Response(
        JSON.stringify({ error: 'competitor_tags array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    const portfolioSection = user_portfolio.length > 0
      ? `USER'S PORTFOLIO (${user_portfolio.length} unique tags from their analysis history):\n${
          user_portfolio
            .map((p: { tag: string; uses: number; avg_score: number }) =>
              `  ${p.tag} — used ${p.uses}x, avg score ${p.avg_score}`)
            .join('\n')
        }`
      : `USER'S PORTFOLIO: No history yet. Assess gaps purely on niche/platform fit and note this in strategy_summary.`;

    const userMessage = [
      `Platform: ${platform}`,
      `Region: ${region}`,
      niche_context ? `User's niche / content type: ${niche_context}` : null,
      `\nCOMPETITOR / NICHE HASHTAGS (${competitor_tags.length} tags):\n${competitor_tags.map((t: string) => `  ${t}`).join('\n')}`,
      `\n${portfolioSection}`,
    ].filter(Boolean).join('\n');

    console.log(
      'Gap analysis. Competitor tags:', competitor_tags.length,
      'Portfolio tags:', user_portfolio.length,
      'Platform:', platform,
      'Region:', region,
    );

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
        temperature: 0.35,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} — ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content);

    console.log(
      'Gap analysis complete.',
      'Gaps:', parsed.gaps?.length ?? 0,
      'User edge:', parsed.user_edge?.length ?? 0,
      'Common ground:', parsed.common_ground?.length ?? 0,
      'Overlap:', parsed.overlap_strength,
    );

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-hashtag-gaps:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
