import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_name, brand_url, industry, geography, country } = await req.json();

    if (!brand_name) {
      return new Response(
        JSON.stringify({ error: 'brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ error: 'PERPLEXITY_API_KEY must be configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const location = geography || country || 'Unknown location';
    const countryLabel = country || geography || 'their country';
    const industryLabel = industry || 'their industry';

    const prompt = `You are a competitive intelligence analyst. Find exactly 5 real competitors for the following brand and return them as a JSON object.

Brand: ${brand_name}
Website: ${brand_url || 'unknown'}
Industry: ${industryLabel}
City/Region: ${location}
Country: ${countryLabel}

Return exactly this breakdown:
- 2 LOCAL competitors: direct competitors based in ${location} or the same region
- 1 NATIONAL competitor: a well-known competitor operating at the ${countryLabel} level
- 2 GLOBAL/ASPIRATIONAL competitors: world-class brands in ${industryLabel} that ${brand_name} aspires to compete with

Rules:
- Only include real, currently active brands with real websites
- Never include ${brand_name} itself
- For aspirational picks, choose globally recognised brands the user would be proud to be compared to
- The "why_relevant" must be one specific, punchy sentence (no buzzwords)

Return ONLY this JSON, no markdown, no explanation:
{
  "competitors": [
    {
      "name": "Brand Name",
      "domain": "example.com",
      "type": "local",
      "why_relevant": "One specific sentence.",
      "is_aspirational": false
    }
  ]
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive intelligence analyst. Always respond with valid JSON only. No markdown fences, no explanation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // Strip markdown fences if model added them despite instructions
    const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    const parsed = JSON.parse(cleaned);
    const competitors = (parsed.competitors ?? []).slice(0, 5);

    return new Response(
      JSON.stringify({ competitors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in find-competitors:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', competitors: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
