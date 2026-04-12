import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an Instagram hashtag trend analyst (2026).
Assess the CURRENT trajectory of each hashtag provided.

For each tag return:
- status: exactly one of "rising" | "plateauing" | "declining"
  · rising: actively gaining new creator adoption, accelerating post frequency, growing audience engagement
  · plateauing: stable usage — neither growing nor shrinking significantly, consistent engagement
  · declining: losing creator adoption, slowing post frequency, audience migrating to newer tags
- score: 0–100 current momentum score
  · 80–100: strong, accelerating momentum
  · 50–79: moderate, stable signal
  · 20–49: weakening, losing ground
  · 0–19: near-dead or very niche with minimal activity
- note: one sharp, specific sentence explaining the current trajectory signal — name the niche dynamic, not generic statements

Return ONLY valid JSON with this exact structure:
{
  "results": [
    { "tag": "#example", "status": "rising", "score": 72, "note": "..." }
  ]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tags, user_id } = await req.json();

    if (!Array.isArray(tags) || tags.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tags array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    const tagList = tags.map((t: string) => `- ${t}`).join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Assess the current Instagram trend trajectory for these hashtags:\n${tagList}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} — ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content);
    const results: Array<{ tag: string; status: string; score: number; note: string }> =
      parsed.results ?? [];

    console.log(
      `Checked ${results.length} tags.`,
      `Rising: ${results.filter((r) => r.status === 'rising').length}`,
      `Plateauing: ${results.filter((r) => r.status === 'plateauing').length}`,
      `Declining: ${results.filter((r) => r.status === 'declining').length}`,
    );

    // Persist updated statuses for authenticated users
    if (user_id) {
      try {
        const supabaseUrl        = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseServiceKey) {
          const db = createClient(supabaseUrl, supabaseServiceKey);
          const now = new Date().toISOString();
          for (const r of results) {
            await db
              .from('hashtag_watchlist')
              .update({
                trend_status:    r.status,
                trend_score:     r.score,
                trend_note:      r.note,
                last_checked_at: now,
              })
              .eq('user_id', user_id)
              .eq('tag', r.tag);
          }
        }
      } catch (dbErr) {
        console.warn('DB update failed (non-fatal):', dbErr);
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-watchlist-trends:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
