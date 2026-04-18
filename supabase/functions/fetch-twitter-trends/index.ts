import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// trends24.in region slugs
const REGION_SLUGS: Record<string, string> = {
  'UK':           'united-kingdom',
  'USA':          'united-states',
  'India':        'india',
  'Canada':       'canada',
  'Australia':    'australia',
  'Global':       'worldwide',
  'Nigeria':      'nigeria',
  'South Africa': 'south-africa',
  'Pakistan':     'pakistan',
  'Brazil':       'brazil',
};

const ALL_CATEGORIES = [
  'Entertainment','Music','Politics','Sports','Tech','AI',
  'Gaming','Culture','Finance','News','Religion','Fashion','Entrepreneurship',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { region = 'UK', categories = [], count = 20 } = await req.json();

    const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY')!;
    const PERPLEXITY_API_KEY  = Deno.env.get('PERPLEXITY_API_KEY')!;

    if (!OPENAI_API_KEY)     throw new Error('OPENAI_API_KEY not configured');
    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');

    const regionSlug = REGION_SLUGS[region] || 'worldwide';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const todayShort = new Date().toISOString().split('T')[0];

    // ── PASS 1: Fetch raw trend names from trends24.in ─────────────────────
    console.log(`[fetch-twitter-trends] Pass 1 — trends24.in/${regionSlug}`);

    const p1Res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-search-preview',
        tools: [{ type: 'web_search_preview' }],
        input: `Go to https://trends24.in/${regionSlug} and read the MOST RECENT hourly snapshot (the one at the top of the page). Extract the top ${count} trending topics on X (Twitter) exactly as they appear — including any hashtags (#). Return ONLY a JSON array of strings, no explanation:\n["trend1","trend2","trend3",...]`,
      }),
    });

    if (!p1Res.ok) throw new Error(`Pass 1 HTTP ${p1Res.status}`);

    const p1Data = await p1Res.json();
    const p1Text = p1Data.output
      ?.find((o: any) => o.type === 'message')
      ?.content?.find((c: any) => c.type === 'output_text')
      ?.text ?? '';

    const arrMatch = p1Text.match(/\[[\s\S]*?\]/);
    if (!arrMatch) throw new Error(`Pass 1 returned no JSON array. Raw: ${p1Text.slice(0, 300)}`);

    const rawTrends: string[] = JSON.parse(arrMatch[0]).slice(0, count);
    console.log(`[fetch-twitter-trends] Pass 1 — ${rawTrends.length} raw trends:`, rawTrends.slice(0, 5).join(', '));

    if (rawTrends.length === 0) throw new Error('No trends found for this region on trends24.in');

    // ── PASS 2: Verify each trend via Perplexity sonar ─────────────────────
    console.log(`[fetch-twitter-trends] Pass 2 — verifying ${rawTrends.length} trends via Perplexity`);

    const categoryFilter = categories.length > 0
      ? `\nPrioritise trends in these categories: ${(categories as string[]).join(', ')}.`
      : '';

    const p2Prompt = `Today is ${today}. You are verifying why topics are trending on X/Twitter in ${region}.

STRICT ANTI-HALLUCINATION RULES:
1. For each trend below, search "[trend] news ${todayShort}" to find why it is trending TODAY
2. NEVER assume a trend is about a holiday/date without a news article from TODAY confirming it
3. NEVER infer why a celebrity/person is trending without finding a specific article from TODAY
4. If no confirmed reason found: set confidence="low" and why_trending="Reason unverified after search"
5. Be honest — confidence="high" means you found a direct news article from today or yesterday

TRENDS TO VERIFY (from trends24.in/${regionSlug}):
${rawTrends.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${categoryFilter}

Classify velocity based on how long you estimate it has been trending:
- "rising"  = appeared in last 2 hours (breaking news, just posted)
- "stable"  = trending 2–6 hours
- "fading"  = trending more than 6 hours

Available categories: ${ALL_CATEGORIES.join(' | ')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "fetched_at": "${new Date().toISOString()}",
  "region": "${region}",
  "platform": "Twitter",
  "top_insight": "One actionable marketer insight based only on verified high-confidence trends (1 sentence)",
  "accuracy_notes": "Brief note on scan quality",
  "trends": [
    {
      "rank": 1,
      "name": "exact trend name from the list above",
      "category": "one category from the list",
      "velocity": "rising | stable | fading",
      "freshness_hours": 2,
      "why_trending": "Verified reason, max 15 words. Or: Reason unverified after search",
      "confidence": "high | medium | low",
      "marketer_signal": "Actionable brand opportunity, max 12 words. null if confidence=low"
    }
  ]
}`;

    const p2Res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a trend verification agent with live web search. Your job is to find out WHY topics are trending right now using real news sources. Return only valid JSON.',
          },
          { role: 'user', content: p2Prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!p2Res.ok) {
      const errText = await p2Res.text();
      throw new Error(`Pass 2 (Perplexity) HTTP ${p2Res.status}: ${errText.slice(0, 200)}`);
    }

    const p2Data = await p2Res.json();
    const p2Text = p2Data.choices?.[0]?.message?.content ?? '';

    // Strip markdown code fences if present
    const cleanedP2 = p2Text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const objMatch = cleanedP2.match(/\{[\s\S]*\}/);
    if (!objMatch) throw new Error(`Pass 2 returned no JSON object. Raw: ${p2Text.slice(0, 300)}`);

    const verified = JSON.parse(objMatch[0]);
    let finalTrends = verified.trends || [];

    // Apply category filter if specified
    if (categories.length > 0) {
      finalTrends = finalTrends.filter((t: any) =>
        (categories as string[]).some(c => c.toLowerCase() === t.category?.toLowerCase())
      );
    }

    console.log(`[fetch-twitter-trends] Done — ${finalTrends.length} verified trends (${categories.length > 0 ? 'filtered' : 'all categories'})`);

    return new Response(
      JSON.stringify({ ...verified, trends: finalTrends, raw_count: rawTrends.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fetch-twitter-trends] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', trends: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
