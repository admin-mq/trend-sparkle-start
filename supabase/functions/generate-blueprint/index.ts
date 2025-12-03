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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_profile, trend_id, chosen_direction } = await req.json();
    console.log('Received request for generate-blueprint:', { user_profile, trend_id, chosen_direction });

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

      const systemPrompt = `You are an expert content execution strategist. You receive:
- A brand profile (with tone, audience, content_format, and primary_goal)
- A trending topic (with a detailed description of why it is trending now)
- A chosen creative direction (title, summary, hook, visual_idea, suggested_cta)

Your task is to produce a clear, actionable execution blueprint that a content creator can follow to produce the content.

IMPORTANT: Use the trend's description to reference the ACTUAL reasons the trend is viral (specific events, emotional themes, cultural moments, leaks, finales, etc.) rather than generic commentary. Make the blueprint specific and grounded in the real context of why this trend is popular.

The blueprint JSON must contain:
{
  "trend_id": "...",
  "idea_id": number,
  "detailed_direction": {
    "concept": "3-5 sentence overview of the content piece, referencing specific elements from the trend description",
    "script_outline": ["4-8 bullet items describing each slide/scene/moment in the content"],
    "caption": "Full caption for the post, 2-5 sentences, including relevant emojis and a CTA",
    "recommended_hashtags": ["5-10 hashtags like #example, relevant to the trend and brand"],
    "extra_tips": ["3-6 short actionable tips for maximum engagement"]
  }
}

Respond ONLY with valid JSON in the exact format above.`;

      const userMessage = JSON.stringify({
        user_profile,
        trend,
        chosen_direction
      });

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
