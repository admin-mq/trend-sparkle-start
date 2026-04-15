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
    const { brand_name, domain, industry, geography, audience, competitors } = await req.json();

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

    const competitorNames = (competitors ?? [])
      .map((c: any) => c.name || c.domain)
      .filter(Boolean)
      .join(', ') || 'unknown';

    const geoLabel = geography || 'Global';
    const industryLabel = industry || 'their industry';
    const audienceLabel = audience || 'general consumers';

    const prompt = `You are a PR and search visibility strategist. A brand wants to know which AI search prompts they should track — these are the queries their target buyers type into ChatGPT, Perplexity, or Google AI Overviews when looking for products or services like theirs.

Brand: ${brand_name}
Website: ${domain || 'unknown'}
Industry: ${industryLabel}
Geography: ${geoLabel}
Target audience: ${audienceLabel}
Key competitors: ${competitorNames}

Generate exactly 5 high-value AI search prompts this brand should track. Each prompt must:
- Be a real natural-language question or phrase a buyer or journalist would type into an AI tool
- Be specific enough that winning a mention would be genuinely valuable
- Cover a mix of: buying-intent queries, comparison queries, and category-leadership queries
- Be relevant to ${geoLabel} if the brand is location-specific

Return ONLY this JSON, no markdown, no explanation:
{
  "prompts": [
    "prompt one here",
    "prompt two here",
    "prompt three here",
    "prompt four here",
    "prompt five here"
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
            content: 'You are a PR and search visibility strategist. Always respond with valid JSON only. No markdown fences, no explanation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
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
    const prompts: string[] = (parsed.prompts ?? []).slice(0, 5).filter(Boolean);

    return new Response(
      JSON.stringify({ prompts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-pr-prompts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', prompts: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
