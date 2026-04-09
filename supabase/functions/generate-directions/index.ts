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

    // Try to get OpenAI recommendations
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const systemPrompt = `You are a veteran social-first creative director who has shipped thousands of viral posts.

You receive:
- a brand profile,
- ONE trend (with a detailed description explaining why it's viral now),
- the brand's preferred content_format (e.g. video, carousel, short-form).

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
Create EXACTLY 5 distinct creative directions (content concepts) for how this brand can use this trend.

Each idea MUST:
- Be obviously inspired by the trend description (specific scenes, rumours, emotions, memes – not generic references).
- Match the brand's tone (for example 'witty but classy') in wording and attitude.
- Fit the specified content_format (e.g. if 'video', think in shots / beats; if 'carousel', think in slides).
- Support the primary_goal (e.g. saves, profile visits, app downloads) with a clear angle.

Content rules:
- Each idea must feel different from the others:
  - use different formats (POV, challenge, skit, stitch, before/after, breakdown, etc.),
  - use different emotional angles (humour, nostalgia, tension, education, call-out, etc.).
- Hooks:
  - MUST be specific, bold, and scroll-stopping.
  - Avoid generic hooks like 'you need to see this' or 'here's how'.
  - Max ~140 characters.
- Avoid buzzwords like 'drive engagement', 'resonate', 'compelling content'.
- Sound like a clever creator, not a marketing deck.

Output JSON shape:

{
  "trend_id": "...",
  "creative_directions": [
    {
      "idea_id": 1,
      "title": "Short punchy name for the idea",
      "summary": "2–3 sentences describing the idea in the brand's tone.",
      "hook": "One strong hook line, max ~140 characters.",
      "visual_idea": "1–3 sentences describing what viewers SEE in this format.",
      "suggested_cta": "One call-to-action line that matches the primary_goal."
    }
  ]
}

Respond ONLY with JSON.`;

      // Build a rich trend context block so GPT always knows WHY the trend is happening
      const trendContextLines: string[] = [];
      trendContextLines.push(`Trend name: ${trend.trend_name}`);
      if (timing) trendContextLines.push(`Trend phase: ${timing} (${timing === 'early' ? 'just breaking — first-mover advantage' : timing === 'peaking' ? 'at peak virality now' : 'already widespread'})`);
      if (region) trendContextLines.push(`Region: ${region}`);
      // Description from DB (raw signal context)
      if (trend.description) trendContextLines.push(`\nWhy it's trending (raw signal):\n${trend.description}`);
      // why_good_fit from recommend-trends — this is the richest contextual signal
      if (why_good_fit) trendContextLines.push(`\nWhy this trend fits this brand:\n${why_good_fit}`);
      if (angle_summary) trendContextLines.push(`\nSuggested angle:\n${angle_summary}`);
      if (example_hook) trendContextLines.push(`\nExample hook already generated:\n"${example_hook}"`);

      const trendContext = trendContextLines.join('\n');

      const userMessage = `
Here is the brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the brand memory (style guide):
${JSON.stringify(brandMemory, null, 2)}

⚡ TREND CONTEXT (read this carefully before generating any ideas):
${trendContext}

IMPORTANT: Every idea MUST be rooted in the specific reason this trend is viral RIGHT NOW (see "Why it's trending" above). Do NOT generate generic ideas that just mention the trend name — the ideas must directly reference the actual story, event, controversy, or meme driving this trend. If the trend is about a ban, scandal, launch, or specific event, every idea should make that crystal clear.

Please create exactly 5 distinct creative directions for how this brand can use this trend.

Return a JSON object with "trend_id" and "creative_directions" array (5 items).
Each idea needs: idea_id, title, summary, hook, visual_idea, suggested_cta.

Make each idea feel different (different formats, different emotional angles).
Use specific details from the trend context – no generic phrases or marketing buzzwords.
`;

      console.log('Calling OpenAI API for creative directions...');
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

      // Ensure we have the correct structure
      const creative_directions = parsedResponse.creative_directions || [];
      
      console.log(`Returning ${creative_directions.length} AI-powered creative directions`);
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
