import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveFormatSpec, formatSpecPromptBlock } from "../_shared/platform-format.ts";

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
// the deployed function bundle.
const EXTERNAL_SUPABASE_URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const EXTERNAL_SUPABASE_ANON_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.error("[generate-directions] Missing Supabase credentials. Set EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_ANON_KEY or rely on auto-injected SUPABASE_URL/SUPABASE_ANON_KEY.");
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
    const { user_profile, trend_id, trend_name, why_good_fit, angle_summary, example_hook, timing, region, user_id } = await req.json();
    console.log('Received request for generate-directions:', { user_profile, trend_id, trend_name, user_id: user_id || 'anonymous' });

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trend_id) {
      return new Response(
        JSON.stringify({ error: 'trend_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize external Supabase client
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);

    // Fetch brand memory
    const userId = user_id || null;
    const brandName = user_profile.brand_name || "Unknown Brand";
    const brandMemory = await getBrandMemory(externalSupabase, userId, brandName);
    console.log('Brand memory:', brandMemory ? 'found' : 'not found');

    // Fetch the full trend record including description
    const { data: trendData, error: trendError } = await externalSupabase
      .from('trends')
      .select('trend_id, trend_name, description, hashtags, views_last_60h_millions, region, premium_only, active')
      .eq('trend_id', trend_id)
      .maybeSingle();

    if (trendError) {
      console.error('External Supabase error:', trendError);
      throw new Error('Failed to fetch trend from external database');
    }

    if (!trendData) {
      return new Response(
        JSON.stringify({ error: 'Trend not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched trend: ${trendData.trend_name}, description length: ${trendData.description?.length || 0}`);

    // Build the trend object
    const trend = {
      trend_id: trendData.trend_id,
      trend_name: trendData.trend_name,
      description: trendData.description || '',
      hashtags: trendData.hashtags || '',
      views_last_60h_millions: trendData.views_last_60h_millions
    };

    // Try to get Marketers Quest recommendations
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // ─── STEP 1: Live web search to find the REAL reason this trend is happening ───
      let realTimeContext = '';
      try {
        console.log(`Web searching for real-time context on: ${trend.trend_name}`);
        const searchResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-search-preview',
            tools: [{ type: 'web_search_preview' }],
            input: `Why is "${trend.trend_name}" trending right now? Search for recent news (last 7 days). Give me 3-4 specific sentences covering: what happened, who is involved, why people are talking about it, and the emotional reaction online. Be factual and specific — no vague generalisations.`,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          // Extract text from the response output
          const outputItem = searchData.output?.find((o: any) => o.type === 'message');
          const textContent = outputItem?.content?.find((c: any) => c.type === 'output_text');
          if (textContent?.text) {
            realTimeContext = textContent.text;
            console.log(`Got real-time context (${realTimeContext.length} chars)`);
          }
        } else {
          console.warn('Web search response not OK:', searchResponse.status);
        }
      } catch (searchErr) {
        console.warn('Web search step failed (non-fatal):', searchErr);
      }

      // ─── STEP 2: Build rich trend context for idea generation ───
      const trendContextLines: string[] = [];
      trendContextLines.push(`Trend name: ${trend.trend_name}`);
      if (timing) trendContextLines.push(`Trend phase: ${timing} (${timing === 'early' ? 'just breaking — first-mover advantage' : timing === 'peaking' ? 'at peak virality now' : 'already widespread'})`);
      if (region) trendContextLines.push(`Region: ${region}`);

      // Real-time web search context is the MOST IMPORTANT signal
      if (realTimeContext) {
        trendContextLines.push(`\n🔴 REAL-TIME CONTEXT (from live web search — use this as the primary source of truth):\n${realTimeContext}`);
      }
      // DB description as secondary signal
      if (trend.description) trendContextLines.push(`\nStored description:\n${trend.description}`);
      // Brand-specific context from recommend-trends
      if (why_good_fit) trendContextLines.push(`\nWhy this trend fits this brand:\n${why_good_fit}`);
      if (angle_summary) trendContextLines.push(`\nSuggested angle:\n${angle_summary}`);
      if (example_hook) trendContextLines.push(`\nExample hook already generated:\n"${example_hook}"`);

      const trendContext = trendContextLines.join('\n');

      // Tier 2 / #9 — resolve platform-specific format spec so each idea
      // is generated for the actual platform conventions rather than a
      // generic "video" / "carousel" framing.
      const platformSpec = resolveFormatSpec(
        user_profile.platform,
        user_profile.content_format
      );
      const platformSpecBlock = formatSpecPromptBlock(
        platformSpec,
        user_profile.platform || null,
        user_profile.content_format || null
      );

      const systemPrompt = `You are a veteran social-first creative director who has shipped thousands of viral posts.

You receive:
- a brand profile (with industry, business_summary, audience, content_categories),
- ONE trend with REAL-TIME CONTEXT explaining exactly why it's viral right now,
- the brand's preferred content_format (e.g. video, carousel, short-form).

${platformSpecBlock}

Brand memory is provided as a style guide. Use it as the highest priority for voice and tone:
- Match the rhythm and attitude described in voice_profile_text.
- Follow do_list and avoid dont_list.
- If tone_preferences exist, use primary_tones and intensity_preference as extra guidance.

Tone handling:
- Use primary_tone as the main voice.
- Use tone_intensity (1–5): 1–2 mild, 3 balanced, 4–5 strong, bold, creator-grade.
- If primary_tone is 'Naughty', allow premium A-rated innuendo but keep it brand-safe.

Your job:
Create EXACTLY 5 distinct creative directions for how this brand can use this trend.

⚠️ CRITICAL #1 — REAL-TIME RELEVANCE:
The REAL-TIME CONTEXT tells you the specific story, controversy, ban, scandal, or event behind the trend. Every single idea MUST reference those specific details. If Wayne Player was banned — every idea is about the ban. If a show had a shocking finale — every idea references that moment. Generic ideas that just mention the trend name are WRONG.

⚠️ CRITICAL #2 — BRAND ANCHORING (audience-first, applies to EVERY brand/creator regardless of industry):
The audience followed this brand for a reason. AT LEAST 3 of the 5 ideas MUST explicitly bridge the trend back to whatever the audience actually cares about — drawn from user_profile.industry, niche, business_summary, content_categories, and audience. This rule is universal; it applies whether the brand is in SaaS, fashion, fitness, finance, food, gaming, real estate, education, healthcare, automotive, beauty, sports, hospitality, or any other category.

How to anchor (use whichever fits the brand's actual world):
- Industry POV: how someone in this industry sees the trend (e.g. an investor's take on a meme-stock moment, a chef's reaction to a viral dish, a teacher's read on a Gen Z slang).
- Practitioner reaction: what the brand's day-to-day operator/customer/team would say (e.g. "marketers see this", "trainers see this", "florists see this").
- Workflow / tool analogy: map the trend onto something native to the brand's category (e.g. a fashion brand maps a sports controversy to wardrobe staples; a fintech maps a celebrity scandal to financial-decision lessons).
- Audience experience: tie the trend to a moment in the audience's actual life (e.g. parents-of-toddlers, gym-goers, freelancers, brides, gamers, students) — show it on-screen.
- Lesson / breakdown: "what your industry can learn from this moment" — only use this if the others don't fit naturally.

Rules:
- The angle must feel native to the audience — not "Brand X reacts to trend Y" framing. The brand's expertise, customer, or category should be visible in the hook and the visual_idea, not pasted on at the end.
- Read user_profile.industry, niche, and business_summary FIRST — let those dictate the angles you pick. Do NOT use a marketing/SaaS framing for a non-marketing brand. Do NOT use a fitness framing for a non-fitness brand.
- The remaining 1-2 ideas can be broader cultural/emotional takes for variety, but still on-trend and on-brand-tone.
- If the trend is genuinely incompatible with the brand's domain, anchor on the closest legitimate audience link (a values/lifestyle bridge) rather than forcing the brand's product into every idea.

Each idea MUST:
- Directly reference the specific real-time event/story driving the trend.
- Match the brand's tone in wording and attitude.
- Fit the platform-specific format spec above. Every direction must respect the duration window, hook window, and edit-style notes for the actual platform — not a generic "video" notion. A TikTok 7-15s POV idea should NOT look like a YouTube 60s Short idea.
- Support the primary_goal with a clear angle.

Content rules:
- Use different formats per idea: POV, challenge, skit, stitch, before/after, breakdown, etc.
- Use different emotional angles: humour, tension, education, call-out, nostalgia, etc.
- Hooks must be specific and scroll-stopping. Max ~140 characters.
- No buzzwords. Sound like a clever creator, not a marketing deck.

Output JSON shape:
{
  "trend_id": "...",
  "creative_directions": [
    {
      "idea_id": 1,
      "title": "Short punchy name",
      "summary": "2–3 sentences in the brand's tone.",
      "hook": "One strong hook line, max ~140 characters.",
      "visual_idea": "1–3 sentences describing what viewers SEE.",
      "suggested_cta": "One CTA matching the primary_goal.",
      "brand_anchor": "industry" | "audience" | "general",
      "anchor_rationale": "1 short sentence — for 'industry'/'audience' anchors, name the specific link to user_profile.industry / business_summary / audience. For 'general', say why a broader cultural take is worth shipping."
    }
  ]
}

At least 3 of the 5 entries MUST have brand_anchor set to "industry" or "audience". The "general" anchor is allowed for at most 2 entries.

Respond ONLY with JSON.`;

      // Build a focused "brand anchoring digest" so the model can't ignore it.
      // This pulls the fields that matter for audience-relevance into a short
      // block at the top of the user message, in addition to the full profile JSON.
      const anchoringLines: string[] = [];
      if (user_profile.brand_name) anchoringLines.push(`Brand: ${user_profile.brand_name}`);
      if (user_profile.industry) anchoringLines.push(`Industry: ${user_profile.industry}`);
      if (user_profile.niche) anchoringLines.push(`Niche: ${user_profile.niche}`);
      if (user_profile.business_summary) anchoringLines.push(`What the brand does: ${user_profile.business_summary}`);
      if (user_profile.audience) anchoringLines.push(`Audience: ${user_profile.audience}`);
      if (Array.isArray(user_profile.content_categories) && user_profile.content_categories.length > 0) {
        anchoringLines.push(`Content categories: ${user_profile.content_categories.join(', ')}`);
      }
      if (user_profile.geography) anchoringLines.push(`Geography: ${user_profile.geography}`);
      const anchoringDigest = anchoringLines.length > 0
        ? `🎯 BRAND ANCHORING DIGEST (use this to make at least 3 of 5 ideas industry/audience-relevant):\n${anchoringLines.join('\n')}\n`
        : '';

      const userMessage = `
${anchoringDigest}
Here is the full brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the brand memory (style guide):
${JSON.stringify(brandMemory, null, 2)}

⚡ TREND CONTEXT:
${trendContext}

Create exactly 5 distinct creative directions. Every idea must directly reference the specific real-time story/event/controversy (not just the trend name). At least 3 of the 5 ideas must explicitly bridge the trend back to this brand's industry, what the brand does, or what the audience actually cares about (set brand_anchor to "industry" or "audience" on those, with a one-sentence anchor_rationale). Make each idea feel different in format and emotional angle. No generic marketing language.
`;

      // Helper: count how many ideas anchor to industry/audience (vs general).
      const countAnchored = (dirs: any[]): number =>
        Array.isArray(dirs)
          ? dirs.filter((d) => {
              const a = (d?.brand_anchor ?? '').toString().toLowerCase();
              return a === 'industry' || a === 'audience';
            }).length
          : 0;

      const callOpenAI = async (extraNudge: string | null): Promise<any[]> => {
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ];
        if (extraNudge) {
          messages.push({ role: 'user', content: extraNudge });
        }
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.7,
          }),
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('Marketers Quest API error:', resp.status, errorText);
          throw new Error(`Marketers Quest API call failed: ${resp.status}`);
        }
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('No content in Marketers Quest response');
        const parsed = JSON.parse(text);
        return parsed.creative_directions || [];
      };

      console.log('Calling Marketers Quest API for creative directions...');
      let creative_directions = await callOpenAI(null);
      let anchoredCount = countAnchored(creative_directions);
      console.log(`Initial anchoring count: ${anchoredCount}/${creative_directions.length}`);

      // Single retry if the model under-anchored. Bail to whatever we have if
      // the second pass also under-anchors — we don't want to block the UI.
      if (anchoredCount < 3 && creative_directions.length > 0) {
        const nudge = `Your previous response had only ${anchoredCount} of ${creative_directions.length} ideas anchored to the brand's industry or audience. Regenerate the full set of EXACTLY 5 creative_directions so that AT LEAST 3 of them have brand_anchor set to "industry" or "audience" with a clear anchor_rationale tying the trend to user_profile.industry / business_summary / audience. Keep the same trend_id and respond ONLY with JSON in the same shape.`;
        try {
          const retried = await callOpenAI(nudge);
          const retriedCount = countAnchored(retried);
          console.log(`Retry anchoring count: ${retriedCount}/${retried.length}`);
          if (retriedCount > anchoredCount && retried.length >= creative_directions.length) {
            creative_directions = retried;
            anchoredCount = retriedCount;
          }
        } catch (retryErr) {
          console.warn('Anchoring retry failed (non-fatal):', retryErr);
        }
      }

      console.log(`Returning ${creative_directions.length} AI-powered creative directions (${anchoredCount} brand-anchored)`);
      return new Response(
        JSON.stringify({ 
          trend_id: trend.trend_id,
          creative_directions 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Fallback: Return placeholder creative directions
      console.error('AI creative directions failed, using fallback:', aiError);

      const fallbackDirections = Array.from({ length: 5 }, (_, i) => ({
        idea_id: i + 1,
        title: `Idea ${i + 1} for ${trend.trend_name}`,
        summary: `Short summary of how ${user_profile.brand_name} could use ${trend.trend_name} in their content.`,
        hook: `Example hook line mentioning ${trend.trend_name} and ${user_profile.brand_name}`,
        visual_idea: `Simple description of what the visual could look like for this idea.`,
        suggested_cta: `Suggested call-to-action for this idea.`
      }));

      return new Response(
        JSON.stringify({ 
          trend_id: trend.trend_id,
          creative_directions: fallbackDirections 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in generate-directions function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', creative_directions: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
