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
    const { user_profile, trend_id, trend_name } = await req.json();
    console.log('Received request for generate-directions:', { user_profile, trend_id, trend_name });

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

      const systemPrompt = `You are a senior social media creative director. You receive a brand profile and ONE trending topic (including a detailed description of why the trend is popular now).

Your task is to generate exactly 5 creative directions that:
- Are clearly inspired by the trend description (use the specific reasons it's trending, the emotions, events, or cultural moments mentioned)
- Match the brand's tone, content_format, and target audience
- Support the brand's primary_goal

Each idea must include:
- idea_id: a number from 1 to 5
- title: a short catchy name for the idea (max 10 words)
- summary: 2-3 sentences describing the idea in the brand's tone
- hook: one strong hook line, max ~140 characters
- visual_idea: 1-3 sentences describing what viewers would see
- suggested_cta: one call-to-action line

IMPORTANT: Use the trend's description to reference the ACTUAL reasons the trend is viral (specific events, emotional themes, cultural moments, etc.) rather than generic commentary.

Respond ONLY with valid JSON in this exact format:
{
  "trend_id": "T001",
  "creative_directions": [
    {
      "idea_id": 1,
      "title": "Short name of the idea",
      "summary": "2-3 sentence summary in the brand's tone.",
      "hook": "One strong hook line, max ~140 characters.",
      "visual_idea": "1-3 sentences describing what viewers see.",
      "suggested_cta": "One call-to-action line."
    }
  ]
}`;

      const userMessage = JSON.stringify({
        user_profile,
        trend
      });

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
