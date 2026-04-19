import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Which Perplexity model to use for live context.
// sonar-pro does deeper web search and handles "find me the latest news"
// requests much better than the base sonar model.
const PERPLEXITY_MODEL = 'sonar-pro';
const PERPLEXITY_FALLBACK_MODEL = 'sonar';

// ── Helper: call Perplexity with graceful fallback to base sonar ─────────────
async function callPerplexity(apiKey: string, payload: any): Promise<any> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // If sonar-pro isn't enabled for this API key, retry with base sonar
  if (res.status === 400 || res.status === 404) {
    const errText = await res.text();
    if (payload.model !== PERPLEXITY_FALLBACK_MODEL) {
      console.warn(`[generate-tweet] ${payload.model} rejected (${res.status}): ${errText.slice(0, 150)}. Retrying with ${PERPLEXITY_FALLBACK_MODEL}`);
      return callPerplexity(apiKey, { ...payload, model: PERPLEXITY_FALLBACK_MODEL });
    }
  }

  return res;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const {
      user_profile,
      trend,           // TwitterTrend object
      topic_angle,     // optional string
      char_limit = 280 // 280 standard, 25000 premium
    } = await req.json();

    if (!user_profile?.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!trend?.name) {
      return new Response(
        JSON.stringify({ error: 'trend.name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY')!;
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!;

    if (!OPENAI_API_KEY)     throw new Error('OPENAI_API_KEY not configured');
    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');

    const todayShort = new Date().toISOString().split('T')[0];
    const todayLong = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const isPremium = char_limit > 280;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Pull live context — force Perplexity to find the SPECIFIC news
    // event driving this trend right now, not generic facts about the topic.
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[generate-tweet] Step 1 — fetching live context for: "${trend.name}" (model: ${PERPLEXITY_MODEL})`);

    let liveContext = '';
    let liveContextSource: 'live' | 'stale' | 'none' = 'none';

    const ctxPrompt = `URGENT TASK: Find the EXACT news event making "${trend.name}" trend on X/Twitter RIGHT NOW — today is ${todayLong} (${todayShort}).

This topic is ACTIVELY trending on X right now, so there IS a specific, recent event driving it. Your job is to find that event, not to give generic background.

SEARCH STRATEGY:
1. Search for "${trend.name}" news today ${todayShort}
2. Search for "${trend.name}" twitter ${todayShort}
3. Search for "${trend.name} latest"
4. Look at news articles, tweets, and aggregators published in the LAST 24 HOURS
5. If the topic is a person, look for: photographs, statements, appearances, controversies, announcements they made TODAY or YESTERDAY
6. If multiple stories exist, identify the ONE currently dominating discussion

RETURN FORMAT (use these exact section headers):

BREAKING STORY: [1 sentence — the specific event from today/yesterday. Name names, places, dates. e.g. "Joe Rogan was photographed meeting Donald Trump at the White House on Apr 18, 2026"]

DETAILS: [2-4 sentences — key facts: what happened, who was there, what was said, quotes, numbers, reactions from notable figures]

TWITTER SENTIMENT: [What angle people are taking on X — celebratory, outraged, mocking, curious, divided, supportive, etc. Include any notable groups reacting strongly]

KEY PHRASES: [Any hashtags, memes, quotes, or catchphrases being reused in tweets about this. Comma-separated.]

BRAND ANGLE: [How a marketer could authentically tie a brand/product message to this specific event — max 1 sentence]

CRITICAL RULES:
- Do NOT return generic background ("X is a podcaster who...", "Y is a company that...")
- Do NOT guess. If you cannot find a story from the last 48 hours, return "NO_RECENT_STORY_FOUND" as BREAKING STORY and explain what you searched for.
- Real journalism only — cite what you actually found, not inferences.`;

    try {
      const ctxRes = await callPerplexity(PERPLEXITY_API_KEY, {
        model: PERPLEXITY_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a real-time news researcher with live web search. When a topic is trending, you find the specific event driving it — not background facts. Cite specific dates, names, and quotes from real recent articles. Never fabricate.',
          },
          { role: 'user', content: ctxPrompt },
        ],
        temperature: 0.1,
      });

      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        const ctxText = ctxData.choices?.[0]?.message?.content ?? '';
        console.log(`[generate-tweet] Live context response (${ctxText.length} chars):`, ctxText.slice(0, 200));

        if (ctxText.length > 80 && !ctxText.includes('NO_RECENT_STORY_FOUND')) {
          liveContext = ctxText;
          liveContextSource = 'live';
        } else if (ctxText.length > 80) {
          // Perplexity admitted no recent story — use what it did find but flag as weak
          liveContext = ctxText;
          liveContextSource = 'stale';
        }
      } else {
        const errText = await ctxRes.text();
        console.warn(`[generate-tweet] Step 1 Perplexity HTTP ${ctxRes.status}: ${errText.slice(0, 200)}`);
      }
    } catch (ctxErr) {
      console.warn('[generate-tweet] Step 1 live-context fetch failed (non-fatal):', ctxErr);
    }

    // Final fallback — use stale why_trending from the trend card if live fetch failed completely
    if (!liveContext) {
      liveContext = trend.why_trending || `"${trend.name}" is currently trending on X/Twitter.`;
      liveContextSource = 'none';
    }

    console.log(`[generate-tweet] Live context source: ${liveContextSource}`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Generate tweet drafts with OpenAI, treating live context as
    // authoritative. Stale why_trending is only shown as a minor hint when
    // live context is also weak.
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[generate-tweet] Step 2 — generating tweets (char_limit=${char_limit})`);

    const toneDesc = [
      user_profile.primary_tone || user_profile.tone || 'casual',
      user_profile.tone_intensity ? `intensity ${user_profile.tone_intensity}/5` : '',
    ].filter(Boolean).join(', ');

    const topicLine = topic_angle
      ? `\nUser's topic angle: "${topic_angle}" — every tweet must connect the trend to this topic.`
      : '';

    const charNote = isPremium
      ? `Max character limit: ${char_limit.toLocaleString()} characters (Premium account — can write long-form threads or essays).`
      : `Max character limit: ${char_limit} characters (Standard account). Count EVERY character including spaces, hashtags, URLs. Must stay under ${char_limit}.`;

    const formatNote = isPremium
      ? `You may write longer tweets (mini-essays, threads, commentary) — use the extra space for depth.`
      : `Standard tweets only. Keep it tight, punchy, scroll-stopping. Every word must earn its place.`;

    const systemPrompt = `You are a world-class Twitter ghostwriter who writes viral tweets for brands. You write in the brand's voice with precision.

Your rules:
1. Every tweet MUST reference the specific real-world event described in the LIVE CONTEXT — not just the trend name, not generic topic facts
2. Match the brand's tone exactly (${toneDesc})
3. ${charNote}
4. ${formatNote}
5. Each of the 3 drafts must use a different angle/format
6. Hashtags count toward the character limit — choose them carefully
7. No em dashes (—), no AI-sounding phrases like "in the world of", "let's talk about"
8. Sound like a real person who actually has an opinion, not a marketing department

Output JSON only:
{
  "tweets": [
    {
      "draft_id": 1,
      "angle": "Short description of the angle (e.g. Hot take, Humour, Educational, Opinion)",
      "text": "The full tweet text including hashtags",
      "char_count": 0,
      "hashtags": ["#tag1","#tag2"]
    }
  ]
}`;

    // The LIVE CONTEXT block is authoritative. When we have fresh live context
    // we deliberately DO NOT include the stale why_trending from the trend card
    // — otherwise OpenAI averages the two and produces generic copy.
    const liveContextBlock = liveContextSource === 'live'
      ? `━━━ LIVE CONTEXT (AUTHORITATIVE — this is what is ACTUALLY happening today, ${todayShort}) ━━━
${liveContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: The "BREAKING STORY" above is the specific event driving this trend. Every tweet must reference this exact event, not generic facts about "${trend.name}".`
      : liveContextSource === 'stale'
      ? `━━━ CONTEXT (web search did not find a dated article — use carefully) ━━━
${liveContext}

Additional hint from trend scan: ${trend.why_trending || 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : `━━━ CONTEXT (limited — live search unavailable) ━━━
Trend name: ${trend.name}
Best-guess reason: ${trend.why_trending || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

Write tweets that riff on the trend name itself since we don't have specific event details.`;

    const userMessage = `Brand: ${user_profile.brand_name}
Industry: ${user_profile.industry || 'N/A'}
Business: ${user_profile.business_summary || 'N/A'}
Audience: ${user_profile.audience || 'N/A'}
Tone: ${toneDesc}
Primary goal: ${user_profile.primary_goal || 'Engagement'}
${topicLine}

Trend name: ${trend.name}
Category: ${trend.category || 'N/A'}

${liveContextBlock}

Generate 3 tweet drafts. Each must:
- Reference the SPECIFIC event in the live context above (not just the trend name)
- Fit within ${char_limit} characters${topic_angle ? `\n- Connect the trend to: "${topic_angle}"` : ''}
- Use a different angle from the others

After writing each tweet, count the characters carefully and set char_count accurately.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI API error ${openaiRes.status}: ${errText.slice(0, 200)}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in OpenAI response');

    const parsed = JSON.parse(content);
    const tweets = (parsed.tweets || []).map((t: any) => ({
      ...t,
      char_count: t.text?.length || 0, // recalculate to be safe
      over_limit: (t.text?.length || 0) > char_limit,
    }));

    console.log(`[generate-tweet] Done — generated ${tweets.length} drafts (context source: ${liveContextSource})`);

    return new Response(
      JSON.stringify({
        tweets,
        trend_name: trend.name,
        char_limit,
        live_context_source: liveContextSource,  // so UI can show a "fresh vs stale" badge if desired
        live_context_preview: liveContext.slice(0, 400),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[generate-tweet] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', tweets: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
