import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PERPLEXITY_MODEL = 'sonar-pro';

// ── Perplexity: fetch live Instagram hashtag performance signal ───────────────
async function fetchLiveSignal(
  apiKey: string,
  tags: string[],
  nicheContext: string,
  region: string,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const nicheStr = nicheContext || 'general content';
  const regionStr = region === 'global' ? 'worldwide' : region;
  const tagList = tags.slice(0, 25).join(', '); // cap at 25 to keep prompt tight

  const prompt = `Today is ${today}. I need live Instagram hashtag performance data for ${nicheStr} creators in ${regionStr}.

Evaluate these hashtags: ${tagList}

For each hashtag, search for:
1. Approximate current post count on Instagram (e.g. "2.1M posts", "340K posts")
2. Current momentum: growing (increased recent usage), stable, declining, or oversaturated (too many competing posts to stand out)
3. Any content wave, viral moment, or trend driving this tag in the past 2-4 weeks — or note if it is evergreen/niche-stable

Be specific with real data you find. If you cannot find data for a specific tag, say "no recent data". Do not fabricate numbers.`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a social media data researcher with live web search. Provide factual, current Instagram hashtag performance data. Never fabricate metrics — if you cannot find data, say so.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[analyze-hashtag-gaps] Perplexity ${res.status}: ${errText.slice(0, 150)}`);
      return '';
    }

    const data = await res.json();
    const signal = data.choices?.[0]?.message?.content ?? '';
    console.log(`[analyze-hashtag-gaps] Live signal fetched (${signal.length} chars)`);
    return signal;
  } catch (err) {
    console.warn('[analyze-hashtag-gaps] Perplexity call failed (non-fatal):', err);
    return '';
  }
}

// ── GPT system prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a hashtag portfolio strategist for Instagram (2026).

Your task: compare a competitor's / niche's hashtag list against the user's own portfolio and surface actionable gaps.

You will receive a LIVE PERFORMANCE SIGNAL from a real-time web search. Use this to ground your opportunity scores — a tag confirmed as currently growing should score higher; a tag confirmed as oversaturated should score lower or be marked skip. If the live signal has no data for a specific tag, fall back to niche/platform reasoning.

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
- 80–100: High-value gap — live signal confirms growth AND clear audience benefit the user is missing
- 60–79: Moderate opportunity — worth testing with the right content
- 40–59: Marginal — situational upside, proceed with caution
- 0–39: Low value for this user — skip

Adjust scores based on live signal:
- Tag confirmed GROWING → +10 to base score
- Tag confirmed OVERSATURATED → −15 to base score, force risk to "high"
- Tag confirmed DECLINING → −10 to base score
- No live data → score on niche/platform reasoning alone

risk: "low" | "medium" | "high"
- low: relevant, healthy competition window, live signal shows growth or stable
- medium: moderately relevant OR moderate saturation OR audience fit uncertainty
- high: semantic mismatch OR oversaturated (confirmed by live signal) OR attracts wrong audience

reason: one sharp sentence — what SPECIFIC audience or reach benefit does adopting this unlock?
Reference live signal data where available (e.g. "Currently growing at 2.1M posts with strong fashion week momentum").
Not generic "this tag has good engagement".

verdict: "adopt" | "test" | "skip"
- adopt: opportunity_score ≥ 70 AND risk is low or medium
- test: opportunity_score 45–69 OR risk is medium
- skip: opportunity_score < 45 OR risk is high

═══════════════════════════════════════════════
USER EDGE TAG ASSESSMENT
═══════════════════════════════════════════════

type: "differentiator" | "blind_spot" | "niche_specific"
- differentiator: user reaches an audience the competitor misses — worth protecting and doubling down
- blind_spot: user uses this tag but it's likely adding noise or attracting misaligned audience
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

strategy_summary: 2–3 sentences. Reference the specific gap pattern detected AND the live signal where relevant (e.g. "Three of the missing tags are in a current growth cycle..."). Not generic advice.

top_actions: exactly 3 strings. Start each with an action verb. Concrete and specific.

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
If user portfolio is empty, assess gaps purely on niche/platform context and note the lack of personal comparison data in strategy_summary.`;

// ── Serve ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      competitor_tags,
      user_portfolio = [],
      your_tags = [],        // manually pasted own hashtags (replaces empty portfolio)
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

    const openaiApiKey    = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    // ── Build effective portfolio ───────────────────────────────────────────
    // Merge manually-pasted own tags + DB history. Own tags get uses=1, score=0
    // as placeholders — presence is what matters for gap detection.
    const yourTagSet = new Set((your_tags as string[]).map((t: string) => t.toLowerCase()));
    const portfolioFromHistory = (user_portfolio as Array<{ tag: string; uses: number; avg_score: number }>);
    const historyTagSet = new Set(portfolioFromHistory.map(p => p.tag.toLowerCase()));

    // Add manually entered tags not already in history
    const manualEntries = Array.from(yourTagSet)
      .filter(t => !historyTagSet.has(t))
      .map(t => ({ tag: t, uses: 1, avg_score: 0 }));

    const effectivePortfolio = [...portfolioFromHistory, ...manualEntries];

    console.log(
      '[analyze-hashtag-gaps] Competitor tags:', competitor_tags.length,
      '| Portfolio (history):', portfolioFromHistory.length,
      '| Manual own tags:', your_tags.length,
      '| Effective portfolio:', effectivePortfolio.length,
      '| Platform:', platform,
      '| Region:', region,
    );

    // ── Step 1: Fetch live signal from Perplexity (parallel with nothing else — just non-blocking on failure) ──
    let liveSignal = '';
    if (perplexityApiKey) {
      liveSignal = await fetchLiveSignal(
        perplexityApiKey,
        competitor_tags,
        niche_context || '',
        region,
      );
    } else {
      console.warn('[analyze-hashtag-gaps] PERPLEXITY_API_KEY not set — skipping live signal');
    }

    // ── Step 2: Build GPT user message ───────────────────────────────────────
    const portfolioSection = effectivePortfolio.length > 0
      ? `USER'S PORTFOLIO (${effectivePortfolio.length} tags):\n${
          effectivePortfolio
            .map(p => {
              const source = p.uses === 1 && p.avg_score === 0 ? '(manually entered)' : `used ${p.uses}x, avg score ${p.avg_score}`;
              return `  ${p.tag} — ${source}`;
            })
            .join('\n')
        }`
      : `USER'S PORTFOLIO: None provided. Assess gaps purely on niche/platform fit — note this in strategy_summary.`;

    const liveSignalSection = liveSignal
      ? `\n━━━ LIVE PERFORMANCE SIGNAL (from real-time web search — use this to calibrate scores) ━━━\n${liveSignal}\n━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : '\n[No live signal available — score on niche/platform reasoning alone]';

    const userMessage = [
      `Platform: ${platform}`,
      `Region: ${region}`,
      niche_context ? `User's niche / content type: ${niche_context}` : null,
      `\nCOMPETITOR / TARGET HASHTAGS (${competitor_tags.length} tags):\n${competitor_tags.map((t: string) => `  ${t}`).join('\n')}`,
      `\n${portfolioSection}`,
      liveSignalSection,
    ].filter(Boolean).join('\n');

    // ── Step 3: GPT structural analysis ──────────────────────────────────────
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
        temperature: 0.3,
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
      '[analyze-hashtag-gaps] Done.',
      'Gaps:', parsed.gaps?.length ?? 0,
      '| User edge:', parsed.user_edge?.length ?? 0,
      '| Common:', parsed.common_ground?.length ?? 0,
      '| Overlap:', parsed.overlap_strength,
      '| Live signal used:', liveSignal.length > 0,
    );

    return new Response(
      JSON.stringify({ ...parsed, live_signal_used: liveSignal.length > 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-hashtag-gaps] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
