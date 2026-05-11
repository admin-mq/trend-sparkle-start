import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// All valid region codes the rest of the app understands
const VALID_REGIONS = ['US', 'UK', 'IN', 'CA', 'AU', 'NZ'];

const SYSTEM_PROMPT = `You are a social media analyst. Given a creator's raw profile data, extract a clean structured persona.

Rules:
- "niche" must be a single lowercase word or short phrase (e.g. "fashion", "fitness", "tech", "travel", "food", "beauty", "gaming", "finance")
- "sub_niches" are 2-4 specific content angles within the niche (e.g. ["sustainable fashion", "vintage styling"])
- "region_code" must be exactly one of: US, UK, IN, CA, AU, NZ — pick the closest match even with spelling mistakes. If unclear, use "US"
- "location_normalized" is the full country name matching the region code
- "content_style" pick one: educational | inspirational | entertaining | informational | humorous | lifestyle
- "audience_type" is a short description of who follows this creator (e.g. "eco-conscious millennials", "fitness beginners")
- "platform_focus" list platforms mentioned or implied (Instagram, TikTok, YouTube, X, LinkedIn)
- "is_faceless" true if creator explicitly mentions being faceless/anonymous
- "summary" one sentence describing what this creator does and for whom

Always return valid JSON. Never add markdown fences.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, industry, location, bio, full_name } = await req.json();
    if (!user_id) throw new Error('user_id is required');

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build the profile description for OpenAI
    const profileText = [
      full_name   ? `Name: ${full_name}` : null,
      industry    ? `Niche / What they do: ${industry}` : null,
      location    ? `Location: ${location}` : null,
      bio         ? `Bio / Description: ${bio}` : null,
    ].filter(Boolean).join('\n');

    if (!profileText.trim()) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'empty profile — nothing to parse' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[parse-creator-persona] Parsing profile for user ${user_id}`);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Parse this creator profile and return a JSON object:\n\n${profileText}\n\nReturn JSON only:
{
  "niche": "...",
  "sub_niches": ["...", "..."],
  "region_code": "US|UK|IN|CA|AU|NZ",
  "location_normalized": "...",
  "content_style": "...",
  "audience_type": "...",
  "platform_focus": ["..."],
  "is_faceless": false,
  "summary": "..."
}`,
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI error ${openaiRes.status}: ${err.slice(0, 200)}`);
    }

    const openaiData = await openaiRes.json();
    const raw = openaiData.choices?.[0]?.message?.content ?? '';

    // Strip markdown fences if model added them
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    let persona: Record<string, unknown>;
    try {
      persona = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse OpenAI JSON response: ${cleaned.slice(0, 200)}`);
    }

    // Validate and sanitise region_code
    if (!VALID_REGIONS.includes(persona.region_code as string)) {
      persona.region_code = 'US';
    }

    persona.parsed_at = new Date().toISOString();

    console.log(`[parse-creator-persona] Parsed persona for ${user_id}:`, JSON.stringify(persona));

    // Save back to user_profiles
    const { error: updateErr } = await supabase
      .from('user_profiles')
      .update({ creator_persona: persona })
      .eq('user_id', user_id);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return new Response(
      JSON.stringify({ ok: true, persona }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[parse-creator-persona] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
