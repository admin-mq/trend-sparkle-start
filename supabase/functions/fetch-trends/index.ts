import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract hashtags from a caption string */
function extractHashtags(caption: string): string[] {
  if (!caption) return [];
  const matches = caption.match(/#([a-zA-Z][a-zA-Z0-9_]{1,49})/g);
  return matches
    ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))]
    : [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_USER_ACCESS_TOKEN = Deno.env.get('META_USER_ACCESS_TOKEN');
    const META_IG_ACCOUNT_ID    = Deno.env.get('META_IG_ACCOUNT_ID');
    const OPENAI_API_KEY        = Deno.env.get('OPENAI_API_KEY')!;
    const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const today = new Date().toISOString().split('T')[0];

    console.log(`[fetch-trends] Starting Instagram-first trend fetch for ${today}`);

    // ── Strategy toggle ────────────────────────────────────────────────────────
    // If Meta credentials are present, mine Instagram directly (zero search-engine lag).
    // Otherwise fall back to OpenAI web search (1-6 hour lag).
    const useInstagram = !!(META_USER_ACCESS_TOKEN && META_IG_ACCOUNT_ID);
    console.log(`[fetch-trends] Mode: ${useInstagram ? 'Instagram-direct' : 'OpenAI-web-search fallback'}`);

    let trendResearch = '';

    if (useInstagram) {
      // ── PHASE 1: Seed ID resolution ─────────────────────────────────────────
      // Load seeds. Rotate through least-recently-used so every seed gets coverage.
      const { data: seeds = [] } = await supabase
        .from('hashtag_cache')
        .select('id, hashtag, hashtag_id, region, category')
        .eq('is_seed', true)
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(12);

      // For seeds still missing a hashtag_id, search Instagram (up to 10 per run).
      let searchesUsed = 0;
      const MAX_SEARCHES = 10;

      for (const seed of seeds.filter((s: any) => !s.hashtag_id)) {
        if (searchesUsed >= MAX_SEARCHES) break;
        try {
          const res = await fetch(
            `https://graph.facebook.com/v25.0/ig_hashtag_search?user_id=${META_IG_ACCOUNT_ID}&q=${encodeURIComponent(seed.hashtag)}&access_token=${META_USER_ACCESS_TOKEN}`
          );
          if (res.ok) {
            const json = await res.json();
            if (json.data?.[0]?.id) {
              const hashtagId = json.data[0].id;
              await supabase
                .from('hashtag_cache')
                .update({ hashtag_id: hashtagId, last_searched_at: new Date().toISOString() })
                .eq('id', seed.id);
              seed.hashtag_id = hashtagId;
              console.log(`[fetch-trends] Resolved #${seed.hashtag} → ${hashtagId}`);
            }
          }
        } catch (e) {
          console.warn(`[fetch-trends] Could not resolve #${seed.hashtag}:`, e);
        }
        searchesUsed++;
        await delay(350);
      }

      // ── PHASE 2: Pull recent_media for resolved seeds ──────────────────────
      // Aggregate hashtag frequency + engagement signal from post captions.
      const resolvedSeeds = seeds.filter((s: any) => s.hashtag_id);
      const htFreq: Record<string, { count: number; engagement: number; regions: Set<string> }> = {};

      for (const seed of resolvedSeeds) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v25.0/${seed.hashtag_id}/recent_media` +
            `?user_id=${META_IG_ACCOUNT_ID}` +
            `&fields=id,like_count,comments_count,caption,timestamp` +
            `&limit=30` +
            `&access_token=${META_USER_ACCESS_TOKEN}`
          );

          if (!res.ok) {
            console.warn(`[fetch-trends] recent_media failed for #${seed.hashtag}: ${res.status}`);
            await delay(350);
            continue;
          }

          const json = await res.json();
          const posts: any[] = json.data || [];
          console.log(`[fetch-trends] #${seed.hashtag}: ${posts.length} recent posts`);

          for (const post of posts) {
            const tags = extractHashtags(post.caption || '');
            // Engagement score: likes + weighted comments
            const eng = (post.like_count || 0) + (post.comments_count || 0) * 6;

            for (const tag of tags) {
              if (tag === seed.hashtag) continue; // skip the seed itself
              if (!htFreq[tag]) htFreq[tag] = { count: 0, engagement: 0, regions: new Set() };
              htFreq[tag].count++;
              htFreq[tag].engagement += eng;
              htFreq[tag].regions.add(seed.region); // carry the seed's region label
            }
          }

          // Mark seed as used
          await supabase
            .from('hashtag_cache')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', seed.id);

        } catch (e) {
          console.warn(`[fetch-trends] Error fetching recent_media for #${seed.hashtag}:`, e);
        }
        await delay(350);
      }

      // ── PHASE 3: Rank discovered hashtags ─────────────────────────────────
      const ranked = Object.entries(htFreq)
        .filter(([_, v]) => v.count >= 2) // Must appear in at least 2 posts
        .sort((a, b) => b[1].engagement - a[1].engagement)
        .slice(0, 40)
        .map(([tag, data]) => ({
          hashtag: tag,
          count: data.count,
          engagement: data.engagement,
          regions: [...data.regions],
        }));

      console.log(`[fetch-trends] Top discovered hashtags: ${ranked.slice(0, 10).map(r => '#' + r.hashtag).join(', ')}`);

      // ── PHASE 4: Resolve IDs for top discovered hashtags (cache new ones) ──
      const { data: cachedTags = [] } = await supabase
        .from('hashtag_cache')
        .select('hashtag, hashtag_id')
        .in('hashtag', ranked.map((r) => r.hashtag));

      const cacheMap: Record<string, string> = {};
      for (const c of cachedTags as any[]) {
        if (c.hashtag_id) cacheMap[c.hashtag] = c.hashtag_id;
      }

      for (const item of ranked.slice(0, 15)) {
        if (cacheMap[item.hashtag] || searchesUsed >= MAX_SEARCHES) continue;
        try {
          const res = await fetch(
            `https://graph.facebook.com/v25.0/ig_hashtag_search?user_id=${META_IG_ACCOUNT_ID}&q=${encodeURIComponent(item.hashtag)}&access_token=${META_USER_ACCESS_TOKEN}`
          );
          if (res.ok) {
            const json = await res.json();
            if (json.data?.[0]?.id) {
              const hId = json.data[0].id;
              cacheMap[item.hashtag] = hId;
              await supabase.from('hashtag_cache').upsert(
                { hashtag: item.hashtag, hashtag_id: hId, is_seed: false, last_searched_at: new Date().toISOString() },
                { onConflict: 'hashtag' }
              );
            }
          }
        } catch (_) { /* non-fatal */ }
        searchesUsed++;
        await delay(350);
      }

      // Build research summary for GPT
      trendResearch = ranked
        .slice(0, 30)
        .map((r) => `#${r.hashtag} — appeared in ${r.count} posts, engagement score ${r.engagement}, seeded from ${r.regions.join('/')} content`)
        .join('\n');

      console.log(`[fetch-trends] Instagram phase complete. ${ranked.length} candidate hashtags found.`);

    } else {
      // ── FALLBACK: OpenAI web search ────────────────────────────────────────
      console.log(`[fetch-trends] Falling back to OpenAI web search...`);
      const searchPrompt = `Today is ${today}. Search the web and find 20 topics trending on Instagram and TikTok in the UK and USA RIGHT NOW. Be specific — name actual events, matches, shows, songs. List them with hashtag and why it's trending.`;

      const searchRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          tools: [{ type: 'web_search_preview' }],
          input: searchPrompt,
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        trendResearch = searchData.output
          ?.find((o: any) => o.type === 'message')
          ?.content?.find((c: any) => c.type === 'output_text')
          ?.text ?? '';
      }
      if (!trendResearch) throw new Error('Web search returned no results');
    }

    // ── PHASE 5: GPT structures findings → DB-ready JSON ──────────────────────
    const structurePrompt = useInstagram
      ? `You are a UK/USA social media trend analyst. Below is raw Instagram signal data — hashtags extracted from the most recent real posts on the platform right now, ranked by engagement.

INSTAGRAM SIGNAL DATA (extracted live, ${today}):
${trendResearch}

Your task: identify the 15 most interesting, brand-relevant trends for UK and USA audiences from this data.
- Ignore generic or spam hashtags (#love, #photo, #instagood, #beautiful, etc.)
- Prefer hashtags that point to a specific current event, cultural moment, meme, sports result, entertainment release, or viral challenge
- Label each trend as "UK", "USA", or "Global" based on its likely audience
- For each trend, use your knowledge to write a rich description of WHAT it is and WHY it is viral right now

Return ONLY valid JSON:
{
  "trends": [
    {
      "trend_name": "Specific event/moment name (2-5 words)",
      "hashtag": "primaryhashtag",
      "extra_hashtags": "#tag1 #tag2 #tag3 #tag4",
      "views_last_60h_millions": 14.0,
      "description": "3-5 sentences. What is this trend? What specific event/moment triggered it? What are people posting (reactions, recreations, memes, commentary)? What is the emotional hook driving engagement?",
      "region": "UK",
      "premium_only": false
    }
  ]
}`
      : `Based on this web research about trending social media topics in the UK and USA on ${today}, structure exactly 15 trend entries:

${trendResearch}

Return ONLY valid JSON:
{
  "trends": [
    {
      "trend_name": "Specific trend name (2-5 words)",
      "hashtag": "primaryhashtag",
      "extra_hashtags": "#tag1 #tag2 #tag3 #tag4",
      "views_last_60h_millions": 14.0,
      "description": "3-5 sentences about why this is trending right now, what people are posting, and the emotional hook.",
      "region": "UK",
      "premium_only": false
    }
  ]
}

Rules: hashtag = lowercase, no # or spaces. Order by virality desc. region = UK | USA | Global.`;

    const structureRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: structurePrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      }),
    });

    if (!structureRes.ok) throw new Error(`GPT structure call failed: ${structureRes.status}`);
    const structureData = await structureRes.json();
    const parsedTrends = JSON.parse(structureData.choices[0].message.content);
    const trends: any[] = parsedTrends.trends || [];
    console.log(`[fetch-trends] GPT structured ${trends.length} trends`);

    // ── PHASE 6: Upsert to trends table ───────────────────────────────────────
    let upserted = 0, errors = 0;

    for (const trend of trends) {
      const slug = trend.trend_name
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 28);
      const trend_id = `TQ-${today}-${slug}`;
      const hashtags = `#${trend.hashtag} ${(trend.extra_hashtags || '').trim()}`.trim();

      const { error } = await supabase.from('trends').upsert(
        {
          trend_id,
          trend_name: trend.trend_name,
          description: trend.description,
          hashtags,
          views_last_60h_millions: trend.views_last_60h_millions,
          region: trend.region || 'Global',
          premium_only: trend.premium_only ?? false,
          active: true,
          date_added: today,
        },
        { onConflict: 'trend_id', ignoreDuplicates: false }
      );

      if (error) { console.error(`Upsert error ${trend_id}:`, error); errors++; }
      else upserted++;
    }

    // ── PHASE 7: Deactivate trends older than 7 days ──────────────────────────
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    await supabase
      .from('trends')
      .update({ active: false })
      .lt('date_added', cutoff.toISOString().split('T')[0])
      .eq('active', true);

    const result = {
      success: true,
      date: today,
      source: useInstagram ? 'instagram-direct' : 'openai-web-search',
      trends_upserted: upserted,
      errors,
    };
    console.log(`[fetch-trends] Done:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[fetch-trends] Fatal:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
