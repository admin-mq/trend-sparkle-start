import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_profile } = await req.json();

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'Brand name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch top 5 trends
    const { data: trends, error } = await supabase
      .from('trends')
      .select('trend_id, trend_name, views_last_60h_millions')
      .eq('region', 'Global')
      .eq('premium_only', false)
      .eq('active', true)
      .order('views_last_60h_millions', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trends' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enrich trends with placeholder AI recommendations
    const recommended_trends = (trends || []).map((trend) => ({
      ...trend,
      why_good_fit: `This is a strong fit for ${user_profile.brand_name} because it is a high-attention global trend.`,
      example_hook: `Example hook text mentioning ${trend.trend_name} for ${user_profile.brand_name}`,
      angle_summary: `Short summary of how ${user_profile.brand_name} could use ${trend.trend_name} in their content.`,
    }));

    return new Response(
      JSON.stringify({ recommended_trends }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recommend-trends function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
