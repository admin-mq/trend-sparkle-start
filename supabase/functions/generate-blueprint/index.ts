import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// External Supabase credentials (user's own project with trends data)
const EXTERNAL_SUPABASE_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbm5wZHJldmJraGJoendjY3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTg3ODQsImV4cCI6MjA3OTk3NDc4NH0.WKuei-3pR2TphEKjSOOhvNlECrX93Jt9NE5SK2TcD-M";

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
    const { user_profile, trend_id, chosen_direction, user_id } = await req.json();
    console.log('Received request for generate-blueprint:', { user_profile, trend_id, chosen_direction, user_id: user_id || 'anonymous' });

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

    if (!chosen_direction) {
      return new Response(
        JSON.stringify({ error: 'chosen_direction is required' }),
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

    // Try to get OpenAI blueprint
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const isVideo = /video|reels|tiktok/i.test(user_profile.content_format || "");
      const isFaceless = user_profile.is_faceless === true;

      const systemPrompt = `You are a high-level social media director turning ideas into shootable scripts.

You receive:
- a creator/brand profile,
- ONE trend with a detailed description of why it is viral now,
- ONE selected creative direction (title, summary, hook, visual_idea, CTA),
- the content_format (video, carousel, etc.).

Creator context:
${isFaceless ? "⚠️ FACELESS ACCOUNT: This creator does NOT show their face. All shot suggestions must use voiceover, text overlays, hands/objects only shots, b-roll, screen recordings, or animations. Never suggest selfie, talking-head, or on-camera presenter shots." : "✅ Face-on account: on-camera and talking-head content is fine."}

Brand memory is provided as a style guide. Use it as the highest priority for voice and tone:
- Match the rhythm and attitude described in voice_profile_text.
- Follow do_list and avoid dont_list.
- If tone_preferences exist, use primary_tones and intensity_preference as extra guidance together with the current tone and tone_intensity controls.

Tone handling:
- The brand tone may include multiple styles (tones array). Use primary_tone as the main voice.
- Use tone_intensity (1–5) to control how strongly the tone is expressed:
  1–2 mild, 3 balanced, 4–5 strong, bold, creator-grade.
- If primary_tone is 'Naughty', allow premium A-rated innuendo but keep it non-explicit and brand-safe.

Your job:
Turn this into a clear execution blueprint that a creator could follow TODAY.

General rules:
- Use the brand's tone (for example, 'classic and funny' should sound playful but not cringe).
- Use specifics from the trend description (names, scenes, rumours, emotional beats).
- Make the first 3 seconds / first slide absolutely unskippable.

Field requirements:

1) concept
- 3–5 sentences.
- Explain the story in plain language, highlighting:
  - the emotional hook,
  - how the trend is woven in,
  - what viewers are supposed to feel or do.

2) script_outline
- 4–8 bullet points.
- Each bullet is ONE scene/shot or ONE carousel slide.
- For video, mention:
  - camera framing respecting the faceless/face-on context above,
  - key on-screen text or dialogue,
  - where the trend reference appears (audio, quote, visual gag).
- For carousel, mention what the slide headline says and what image is shown.
- Bring the hook in the first bullet.

${isVideo ? `3) full_script
- Only for video content.
- Write the complete spoken voiceover/script word-for-word.
- Include [SCENE] markers matching script_outline steps.
- Include [TEXT OVERLAY] notes where on-screen text appears.
- Total length: 60–90 seconds when read aloud (~150–225 words).
- Match the tone exactly.` : ""}

${isVideo ? "4)" : "3)"}) caption (short)
- 2–5 sentences.
- Combine:
  - a strong opening line (pattern interrupt),
  - 1–2 concrete details from the trend,
  - a clear CTA aligned to primary_goal.
- Avoid generic phrases like 'join us on this journey'.

${isVideo ? "5)" : "4)"}) long_caption
- A keyword-rich extended version of the caption (150–250 words).
- Naturally weave in niche keywords, the trend name, location (if relevant), and 3–5 long-tail phrases people actually search for.
- Structured: hook sentence → 2-3 value paragraphs → CTA → relevant keywords list at the end (comma-separated, no hashtags).
- Purpose: maximise discoverability via Instagram/TikTok keyword search.

${isVideo ? "6)" : "5)"}) recommended_hashtags
- 5–10 hashtags:
  - include relevant trend hashtags,
  - add niche/goal-relevant tags,
  - no duplicates,
  - no generic #content or #marketing.

${isVideo ? "7)" : "6)"}) extra_tips
- 3–6 bullets.
- Each bullet is a practical execution tip such as:
  - timing (e.g. post right after a new episode drops),
  - small production tricks,
  - variations for future posts.

Output JSON shape:

{
  "trend_id": "...",
  "idea_id": number,
  "detailed_direction": {
    "concept": "...",
    "script_outline": ["...", "..."],
    ${isVideo ? '"full_script": "...",\n    ' : ''}"caption": "...",
    "long_caption": "...",
    "recommended_hashtags": ["#...", "#..."],
    "extra_tips": ["...", "..."]
  }
}

Respond ONLY with JSON.`;

      const userMessage = `
Here is the brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the brand memory (style guide):
${JSON.stringify(brandMemory, null, 2)}

Here is the trend (with a description of why it's currently viral):
${JSON.stringify(trend, null, 2)}

Here is the chosen creative direction:
${JSON.stringify(chosen_direction, null, 2)}

Please create a detailed execution blueprint for this idea.

Return a JSON object with:
- trend_id
- idea_id
- detailed_direction with these fields:
    - concept
    - script_outline
${isVideo ? "    - full_script  (REQUIRED — full word-for-word voiceover with [SCENE] and [TEXT OVERLAY] markers, 60–90 seconds when read aloud)\n" : ""}    - caption  (short, 2–5 sentences)
    - long_caption  (REQUIRED — 150–250 word keyword-rich extended caption for discoverability)
    - recommended_hashtags
    - extra_tips

Use specifics from the trend description – names, scenes, rumours, emotional beats.
Avoid buzzwords like 'drive engagement', 'resonate', 'compelling content'.
Make it something a creator could actually shoot today.
${isVideo ? "Do NOT omit full_script. Write the complete voiceover dialogue.\n" : ""}Do NOT omit long_caption. Write the long-form keyword-rich version.
`;

      console.log('Calling OpenAI API for execution blueprint...');
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
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        throw new Error(`OpenAI API call failed: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      console.log('OpenAI response received, parsing...');
      const parsedResponse = JSON.parse(content);

      console.log('Returning AI-powered execution blueprint');
      return new Response(
        JSON.stringify({
          trend_id: trend.trend_id,
          trend_hashtags: trend.hashtags,
          idea_id: chosen_direction.idea_id,
          detailed_direction: parsedResponse.detailed_direction
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Fallback: Return placeholder blueprint
      console.error('AI blueprint generation failed, using fallback:', aiError);

      const fallbackBlueprint = {
        concept: `High-level idea of how ${user_profile.brand_name} can use ${trend.trend_name} with the idea "${chosen_direction.title}". This approach combines the trending content style with your brand's unique voice to create engaging content that resonates with your audience.`,
        script_outline: [
          `Slide 1: Hook about ${trend.trend_name} that grabs attention for ${user_profile.brand_name}`,
          `Slide 2: Explain the connection between ${trend.trend_name} and your audience's needs`,
          `Slide 3: Show how ${user_profile.brand_name} uniquely approaches this trend`,
          `Slide 4: Present the main value proposition using ${chosen_direction.title}`,
          `Slide 5: Include social proof or results related to ${trend.trend_name}`,
          `Slide 6: End with a strong call-to-action: ${chosen_direction.suggested_cta}`
        ],
        caption: `🔥 ${trend.trend_name} is taking over, and here's how ${user_profile.brand_name} is making it work! ${chosen_direction.hook} Ready to see the results? Check out our approach and let us know what you think! ${chosen_direction.suggested_cta}`,
        recommended_hashtags: [
          `#${trend.trend_name.replace(/\s+/g, '')}`,
          '#marketing',
          '#content',
          `#${user_profile.brand_name.replace(/\s+/g, '')}`,
          '#trending',
          '#socialmedia'
        ],
        extra_tips: [
          `Post during peak engagement hours for your ${user_profile.audience} audience`,
          `Use the trending audio or format associated with ${trend.trend_name}`,
          `Keep the visual style consistent with your brand identity`,
          `Engage with comments quickly to boost algorithmic reach`,
          `Consider creating a series of posts around this trend for maximum impact`
        ]
      };

      return new Response(
        JSON.stringify({
          trend_id: trend.trend_id,
          trend_hashtags: trend.hashtags,
          idea_id: chosen_direction.idea_id,
          detailed_direction: fallbackBlueprint
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in generate-blueprint function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
