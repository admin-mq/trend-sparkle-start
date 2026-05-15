import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_VERSION  = 'v21.0';
const MAX_HASHTAGS      = 5;
const TOP_MEDIA_PER_TAG = 4;

// Extract most-frequent hashtags from post captions
function extractTopHashtags(captions: string[], limit: number): string[] {
  const freq = new Map<string, number>();
  for (const caption of captions) {
    const matches = caption.match(/#(\w+)/g) ?? [];
    for (const tag of matches) {
      const t = tag.slice(1).toLowerCase();
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { user_id } = await req.json();
    if (!user_id) return json({ error: 'user_id is required' }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Load connection
    const { data: conn } = await db
      .from('instagram_connections')
      .select('instagram_user_id, access_token, username, profile_picture_url')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!conn) return json({ error: 'No Instagram connection found' }, 404);

    const { instagram_user_id: igUserId, access_token: token } = conn;

    // 2. Load synced posts
    const { data: posts } = await db
      .from('instagram_synced_posts')
      .select('caption, media_type, posted_at, permalink, impressions, reach, saved, shares')
      .eq('user_id', user_id)
      .order('posted_at', { ascending: false })
      .limit(25);

    const syncedPosts = posts ?? [];

    // 3. OpenAI performance summary
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let summary: Record<string, unknown> | null = null;

    if (OPENAI_API_KEY && syncedPosts.length > 0) {
      const postsBlock = syncedPosts.map((p, i) => {
        const cap = p.caption ? p.caption.slice(0, 120) : '(no caption)';
        return `[${i + 1}] ${p.media_type ?? 'POST'} | impressions:${p.impressions ?? 0} reach:${p.reach ?? 0} saves:${p.saved ?? 0} shares:${p.shares ?? 0}\n    "${cap}"`;
      }).join('\n');

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: 'You are a social media performance analyst. Analyse the creator\'s recent Instagram post metrics and return a JSON object with actionable insights. Be specific and direct — no fluff.',
            },
            {
              role: 'user',
              content: `Analyse these ${syncedPosts.length} Instagram posts and return JSON only:\n\n${postsBlock}\n\nReturn:\n{\n  "best_content_type": "one sentence on which media type performs best and why",\n  "top_engagement_driver": "what topic or format is driving saves/shares",\n  "reach_trend": "improving | stable | declining — with a one-sentence reason",\n  "recommendations": ["actionable tip 1", "actionable tip 2", "actionable tip 3"],\n  "headline": "one punchy sentence summarising their Instagram performance right now"\n}`,
            },
          ],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? '';
        try {
          summary = JSON.parse(raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim());
        } catch {
          console.warn('[ig-performance-analysis] Failed to parse OpenAI JSON');
        }
      }
    }

    // 4. Resolve hashtags to search:
    //    Primary  — top_hashtags from creator persona (set by parse-creator-persona after sync)
    //    Fallback — extract most-used hashtags directly from post captions
    const { data: profile } = await db
      .from('user_profiles')
      .select('creator_persona')
      .eq('user_id', user_id)
      .maybeSingle();

    const personaHashtags: string[] =
      (profile?.creator_persona as Record<string, unknown>)?.top_hashtags as string[] ?? [];

    const captionTexts = syncedPosts
      .map((p) => p.caption ?? '')
      .filter((c) => c.length > 0);

    const hashtagsToSearch = personaHashtags.length > 0
      ? personaHashtags.slice(0, MAX_HASHTAGS)
      : extractTopHashtags(captionTexts, MAX_HASHTAGS);

    console.log(
      `[ig-performance-analysis] source=${
        personaHashtags.length > 0 ? 'persona' : 'captions'
      } hashtags:`, hashtagsToSearch
    );

    // 5. Trending hashtags via Instagram Public Content Access
    const trending: { hashtag: string; posts: unknown[] }[] = [];

    for (const tag of hashtagsToSearch) {
      try {
        const idResp = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(tag)}&access_token=${token}`
        );
        const idData = await idResp.json();
        const hashtagId = idData.data?.[0]?.id;
        if (!hashtagId) {
          console.warn(`[ig-performance-analysis] No hashtag ID for #${tag}:`, idData);
          continue;
        }

        const mediaResp = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${hashtagId}/top_media?user_id=${igUserId}&fields=id,caption,media_type,like_count,comments_count,timestamp,permalink&limit=${TOP_MEDIA_PER_TAG}&access_token=${token}`
        );
        const mediaData = await mediaResp.json();

        if (!mediaData.error && mediaData.data?.length > 0) {
          trending.push({ hashtag: tag, posts: mediaData.data });
        } else if (mediaData.error) {
          console.warn(`[ig-performance-analysis] top_media error for #${tag}:`, mediaData.error);
        }
      } catch (err) {
        console.warn(`[ig-performance-analysis] Hashtag search failed for #${tag}:`, err);
      }
    }

    return json({
      connection: { username: conn.username, profile_picture_url: conn.profile_picture_url },
      posts: syncedPosts,
      summary,
      trending,
    });

  } catch (err) {
    console.error('[ig-performance-analysis] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
