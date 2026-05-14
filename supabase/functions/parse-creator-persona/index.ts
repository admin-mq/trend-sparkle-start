import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_REGIONS = ['US', 'UK', 'IN', 'CA', 'AU', 'NZ'];

const SYSTEM_PROMPT = `You are a social media analyst. Given a creator's profile data and optionally their recent Instagram post captions, extract a clean structured persona.

Rules:
- "niche" must be a single lowercase word or short phrase (e.g. "fashion", "fitness", "tech", "travel", "food", "beauty", "gaming", "finance")
- "sub_niches" are 2-4 specific content angles within the niche (e.g. ["sustainable fashion", "vintage styling"]). If captions are provided, derive these from actual post themes, not just the bio.
- "region_code" must be exactly one of: US, UK, IN, CA, AU, NZ — pick the closest match even with spelling mistakes. If unclear, use "US"
- "location_normalized" is the full country name matching the region code
- "content_style" pick one: educational | inspirational | entertaining | informational | humorous | lifestyle. If captions are provided, base this on the actual writing style.
- "audience_type" is a short description of who follows this creator (e.g. "eco-conscious millennials", "fitness beginners")
- "platform_focus" list platforms mentioned or implied (Instagram, TikTok, YouTube, X, LinkedIn)
- "is_faceless" true if creator explicitly mentions being faceless/anonymous
- "summary" one sentence describing what this creator does and for whom
- "top_hashtags" if captions are provided: the 10 most frequently used hashtags across all posts, lowercase, without the # symbol. If no captions, return an empty array.
- "content_themes" if captions are provided: 3-5 recurring content themes you observe across the posts (e.g. "before/after transformations", "budget tips", "product reviews"). If no captions, return an empty array.
- "ig_enriched" true if captions were provided and used, false otherwise

Always return valid JSON. Never add markdown fences.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, industry, location, bio, full_name, captions } = await req.json();
    if (!user_id) throw new Error('user_id is required');

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const profileText = [
      full_name ? `Name: ${full_name}` : null,
      industry  ? `Niche / What they do: ${industry}` : null,
      location  ? `Location: ${location}` : null,
      bio       ? `Bio / Description: ${bio}` : null,
    ].filter(Boolean).join('\n');

    const captionsArray: string[] = Array.isArray(captions)
      ? captions.filter((c: unknown) => typeof c === 'string' && c.trim().length > 0)
      : [];

    if (!profileText.trim() && captionsArray.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'empty profile — nothing to parse' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captionsBlock = captionsArray.length > 0
      ? `\n\nRecent Instagram post captions (${captionsArray.length} posts):\n${captionsArray.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`
      : '';

    console.log(`[parse-creator-persona] Parsing profile for user ${user_id} (ig_enriched=${captionsArray.length > 0})`);

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
            content: `Parse this creator profile and return a JSON object:\n\n${profileText}${captionsBlock}\n\nReturn JSON only:
{
  "niche": "...",
  "sub_niches": ["...", "..."],
  "region_code": "US|UK|IN|CA|AU|NZ",
  "location_normalized": "...",
  "content_style": "...",
  "audience_type": "...",
  "platform_focus": ["..."],
  "is_faceless": false,
  "summary": "...",
  "top_hashtags": [],
  "content_themes": [],
  "ig_enriched": false
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

    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    let persona: Record<string, unknown>;
    try {
      persona = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse OpenAI JSON response: ${cleaned.slice(0, 200)}`);
    }

    if (!VALID_REGIONS.includes(persona.region_code as string)) {
      persona.region_code = 'US';
    }

    // Normalise arrays in case model returned nulls
    if (!Array.isArray(persona.top_hashtags))  persona.top_hashtags  = [];
    if (!Array.isArray(persona.content_themes)) persona.content_themes = [];

    persona.ig_enriched = captionsArray.length > 0;
    persona.parsed_at   = new Date().toISOString();

    console.log(`[parse-creator-persona] Parsed persona for ${user_id}:`, JSON.stringify(persona));

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
