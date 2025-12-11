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
    const { user_profile, user_id } = await req.json();
    console.log('Received user_profile:', user_profile, 'user_id:', user_id || 'anonymous');

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize EXTERNAL Supabase client (user's project with trends data)
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);

    // Fetch candidate trends from external Supabase
    const { data: trends, error: trendsError } = await externalSupabase
      .from('trends')
      .select('trend_id, trend_name, description, hashtags, views_last_60h_millions, region, premium_only, active')
      .eq('region', 'Global')
      .eq('premium_only', false)
      .eq('active', true)
      .order('views_last_60h_millions', { ascending: false })
      .limit(30);

    if (trendsError) {
      console.error('External Supabase error:', trendsError);
      throw new Error('Failed to fetch trends from external database');
    }

    if (!trends || trends.length === 0) {
      console.log('No trends found');
      return new Response(
        JSON.stringify({ recommended_trends: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${trends.length} candidate trends from external Supabase`);

    // Try to get OpenAI recommendations
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Find the top 2 trends by views to ensure they're included
      const top2TrendIds = trends.slice(0, 2).map(t => t.trend_id);

      const systemPrompt = `You are a senior social media strategist for high-growth creators and brands.

Your job:
- Read a brand profile.
- Read a list of current social media trends, including:
  - a description of WHY they are trending right now
  - recent view volume (views_last_60h_millions).
- Pick exactly 5 trends that will perform best for this brand.

Tone handling:
- The brand tone may include multiple styles (tones array). Use primary_tone as the main voice.
- Use tone_intensity (1–5) to control how strongly the tone is expressed:
  1–2 mild, 3 balanced, 4–5 strong, bold, creator-grade.
- If primary_tone is 'Naughty', allow premium A-rated innuendo but keep it non-explicit and brand-safe.

Rules:
- ALWAYS include the 2 trends with the highest views_last_60h_millions in the final 5.
- For the other 3:
  - Optimise for a mix of:
    - brand fit (industry, niche, audience, tone, content_format, primary_goal)
    - view volume (don't pick dead trends).
- Use the description field: reference specific triggers (leaks, finales, controversies, emotional themes, flashmobs, etc.), not generic statements.
- Avoid clichés like:
  - 'engaging content'
  - 'resonates with your audience'
  - 'leveraging this trend'
  - 'drive engagement'.
- Write like a human creative partner, not a corporate strategist.

For each selected trend you must return:
- trend_id (matching one from the input),
- why_good_fit (2–3 punchy sentences using brand language and the real reasons the trend is hot),
- example_hook (ONE scroll-stopping hook line, max ~140 characters, which can start with an emoji or CAPS),
- angle_summary (1–2 sentences describing the creative angle, not a repeat of why_good_fit).

Always respond with a single valid JSON object.`;

      const trendsForPrompt = trends.map(t => ({
        trend_id: t.trend_id,
        trend_name: t.trend_name,
        description: t.description || '',
        hashtags: t.hashtags || '',
        views_last_60h_millions: t.views_last_60h_millions
      }));

      const userMessage = `
Here is the brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the list of candidate trends (with descriptions of why they are currently viral):
${JSON.stringify(trendsForPrompt, null, 2)}

The 2 trends with the highest views are: ${top2TrendIds.join(', ')} — you MUST include these.

Please select exactly 5 trends and return a JSON object like:

{
  "recommended_trends": [
    {
      "trend_id": "T001",
      "why_good_fit": "2–3 punchy sentences.",
      "example_hook": "One scroll-stopping hook line, max ~140 characters.",
      "angle_summary": "1–2 sentences describing the creative angle."
    }
  ]
}

Focus on very concrete reasons this trend works for this specific brand. Do NOT use generic marketing buzzwords.
`;

      console.log('Calling OpenAI API...');
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

      // Build a map for quick trend lookup
      const trendMap = new Map();
      trends.forEach(t => trendMap.set(t.trend_id, t));

      // Map OpenAI recommendations to full trend objects
      const recommended_trends = parsedResponse.recommended_trends
        .map((rec: any) => {
          const fullTrend = trendMap.get(rec.trend_id);
          if (!fullTrend) {
            console.warn(`Trend ${rec.trend_id} not found in database`);
            return null;
          }
          return {
            trend_id: fullTrend.trend_id,
            trend_name: fullTrend.trend_name,
            views_last_60h_millions: fullTrend.views_last_60h_millions,
            why_good_fit: rec.why_good_fit || '',
            example_hook: rec.example_hook || '',
            angle_summary: rec.angle_summary || ''
          };
        })
        .filter(Boolean);

      console.log(`Returning ${recommended_trends.length} AI-powered recommendations`);
      return new Response(
        JSON.stringify({ recommended_trends }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Fallback: Return top 5 trends with placeholder text
      console.error('AI recommendation failed, using fallback:', aiError);
      
      const fallbackTrends = trends.slice(0, 5).map(trend => ({
        trend_id: trend.trend_id,
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', recommended_trends: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
