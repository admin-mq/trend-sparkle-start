import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const isPremium = char_limit > 280;

    // ── STEP 1: Get live context from Perplexity (last 6 hours) ───────────
    console.log(`[generate-tweet] Step 1 — fetching live context for: ${trend.name}`);

    let liveContext = trend.why_trending || '';

    try {
      const ctxRes = await fetch('https://api.perplexity.ai/chat/completions', {
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
              content: 'You have live web search. Return only factual, specific information. No waffle.',
            },
            {
              role: 'user',
              content: `What is happening with "${trend.name}" on Twitter/X right now? Search for news and tweets from the last 6 hours (today ${todayShort}). Give me:
1. The specific event/story driving it (1–2 sentences)
2. What angle people on Twitter are taking (funny, angry, supportive, etc.)
3. Any key quotes, memes, or phrases being used
4. Any brand/business opportunity angle

Be specific and factual. If it's about a person being banned, say exactly why they were banned. If it's about a game, say the score. Etc.`,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        const ctxText = ctxData.choices?.[0]?.message?.content ?? '';
        if (ctxText.length > 50) {
          liveContext = ctxText;
          console.log(`[generate-tweet] Step 1 — got context (${liveContext.length} chars)`);
        }
      } else {
        console.warn('[generate-tweet] Step 1 Perplexity error:', ctxRes.status);
      }
    } catch (ctxErr) {
      console.warn('[generate-tweet] Step 1 context fetch failed (non-fatal):', ctxErr);
    }

    // ── STEP 2: Generate tweet drafts with OpenAI ─────────────────────────
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
1. Every tweet MUST reference the specific real-world event driving this trend — not just the trend name
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

    const userMessage = `Brand: ${user_profile.brand_name}
Industry: ${user_profile.industry || 'N/A'}
Business: ${user_profile.business_summary || 'N/A'}
Audience: ${user_profile.audience || 'N/A'}
Tone: ${toneDesc}
Primary goal: ${user_profile.primary_goal || 'Engagement'}
${topicLine}

━━━ TREND CONTEXT ━━━
Trend name: ${trend.name}
Category: ${trend.category || 'N/A'}
Verified reason it's trending: ${trend.why_trending || 'Unknown'}
Live context from web (last 6h):
${liveContext}

Marketer signal: ${trend.marketer_signal || 'N/A'}
━━━━━━━━━━━━━━━━━━━━━

Generate 3 tweet drafts. Each must:
- Reference the SPECIFIC story/event above (not just the trend name)
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

    console.log(`[generate-tweet] Done — generated ${tweets.length} drafts`);

    return new Response(
      JSON.stringify({ tweets, trend_name: trend.name, char_limit }),
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
