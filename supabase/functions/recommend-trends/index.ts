import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_profile } = await req.json();

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch candidate trends from Supabase
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('id, trend_name, hashtags, region, views_last_60h_millions')
      .eq('region', 'Global')
      .eq('premium_only', false)
      .eq('active', true)
      .order('views_last_60h_millions', { ascending: false })
      .limit(30);

    if (trendsError) {
      console.error('Supabase error:', trendsError);
      throw new Error('Failed to fetch trends from database');
    }

    if (!trends || trends.length === 0) {
      return new Response(
        JSON.stringify({ recommended_trends: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to get OpenAI recommendations
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Find the top 2 trends by views to ensure they're included
      const top2TrendIds = trends.slice(0, 2).map(t => t.id);

      const systemPrompt = `You are a senior social media strategist. Your task is to analyze a brand profile and a list of trending content topics, then recommend exactly 5 trends that are the best fit for this brand.

CRITICAL REQUIREMENTS:
1. You MUST include the 2 trends with the highest views_last_60h_millions in your final 5 recommendations.
2. Choose 3 additional trends that align well with the brand's profile.
3. For each recommended trend, provide:
   - trend_id: the exact id from the input list
   - why_good_fit: 2-3 sentences explaining why this trend suits the brand
   - example_hook: a single compelling hook line the brand could use
   - angle_summary: 1-2 sentences describing the content angle

Respond ONLY with valid JSON in this exact format:
{
  "recommended_trends": [
    {
      "trend_id": "uuid-here",
      "why_good_fit": "explanation here",
      "example_hook": "hook line here",
      "angle_summary": "angle description here"
    }
  ]
}`;

      const userMessage = JSON.stringify({
        user_profile,
        trends: trends.map(t => ({
          id: t.id,
          trend_name: t.trend_name,
          hashtags: t.hashtags,
          views_last_60h_millions: t.views_last_60h_millions
        })),
        top_2_trend_ids: top2TrendIds
      });

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
        throw new Error('OpenAI API call failed');
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices[0].message.content;
      const parsedResponse = JSON.parse(content);

      // Map OpenAI recommendations to full trend objects
      const recommended_trends = parsedResponse.recommended_trends.map((rec: any) => {
        const fullTrend = trends.find(t => t.id === rec.trend_id);
        if (!fullTrend) {
          console.warn(`Trend ${rec.trend_id} not found in database`);
          return null;
        }
        return {
          trend_id: fullTrend.id,
          trend_name: fullTrend.trend_name,
          views_last_60h_millions: fullTrend.views_last_60h_millions,
          why_good_fit: rec.why_good_fit,
          example_hook: rec.example_hook,
          angle_summary: rec.angle_summary
        };
      }).filter(Boolean);

      return new Response(
        JSON.stringify({ recommended_trends }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Fallback: Return top 5 trends with placeholder text
      console.error('AI recommendation failed, using fallback:', aiError);
      
      const fallbackTrends = trends.slice(0, 5).map(trend => ({
        trend_id: trend.id,
        trend_name: trend.trend_name,
        views_last_60h_millions: trend.views_last_60h_millions,
        why_good_fit: `This is a strong fit for ${user_profile.brand_name} because it is a high-attention global trend.`,
        example_hook: `Example hook using ${trend.trend_name} for ${user_profile.brand_name}`,
        angle_summary: `Short summary of how ${user_profile.brand_name} could use ${trend.trend_name} in their content.`
      }));

      return new Response(
        JSON.stringify({ recommended_trends: fallbackTrends }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in recommend-trends function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
