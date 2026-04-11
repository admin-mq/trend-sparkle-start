import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_VERSION   = 'v20.0';
const INSIGHTS_METRICS   = 'impressions,reach,saved,shares';
const MAX_POSTS_TO_FETCH = 25;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { user_id, link_request_id } = await req.json();
    if (!user_id) return json({ error: 'user_id is required' }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Load connection
    const { data: conn, error: connErr } = await db
      .from('instagram_connections')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    if (connErr || !conn) return json({ error: 'No Instagram connection found. Connect your account first.' }, 404);

    // Check token expiry
    if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
      return json({ error: 'Instagram token has expired. Please reconnect your account.' }, 401);
    }

    const { instagram_user_id: igUserId, access_token: token, id: connectionId } = conn;

    // Fetch recent media
    const mediaResp = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${igUserId}/media?fields=id,caption,media_type,timestamp,permalink&limit=${MAX_POSTS_TO_FETCH}&access_token=${token}`
    );
    const mediaData = await mediaResp.json();

    if (mediaData.error) {
      throw new Error(`Instagram API error: ${mediaData.error.message} (code ${mediaData.error.code})`);
    }

    const posts      = mediaData.data || [];
    let synced       = 0;
    let linked       = 0;
    let insightsFail = 0;

    for (const post of posts) {
      try {
        // Fetch insights for this post
        let metrics: Record<string, number> = {};
        const insightsResp = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${post.id}/insights?metric=${INSIGHTS_METRICS}&access_token=${token}`
        );
        const insightsData = await insightsResp.json();

        if (!insightsData.error && insightsData.data) {
          for (const m of insightsData.data) {
            // Insights can return `values` array or top-level `value`
            metrics[m.name] = m.values?.[0]?.value ?? m.value ?? 0;
          }
        } else {
          insightsFail++;
        }

        // Try to find a matching hashtag_request by caption overlap
        let linkedRequestId: string | null = link_request_id || null;
        if (!linkedRequestId && post.caption) {
          const captionSnippet = post.caption.substring(0, 60).replace(/%/g, '');
          const { data: reqMatch } = await db
            .from('hashtag_requests')
            .select('id')
            .eq('user_id', user_id)
            .ilike('caption', `%${captionSnippet}%`)
            .limit(1)
            .maybeSingle();
          if (reqMatch) linkedRequestId = reqMatch.id;
        }

        // Upsert synced post
        await db
          .from('instagram_synced_posts')
          .upsert({
            connection_id:      connectionId,
            user_id,
            ig_media_id:        post.id,
            caption:            post.caption            || null,
            permalink:          post.permalink          || null,
            media_type:         post.media_type         || null,
            posted_at:          post.timestamp          || null,
            impressions:        metrics.impressions     ?? null,
            reach:              metrics.reach           ?? null,
            saved:              metrics.saved           ?? null,
            shares:             metrics.shares          ?? null,
            linked_request_id:  linkedRequestId,
            synced_at:          new Date().toISOString(),
          }, { onConflict: 'ig_media_id' });

        // Auto-fill hashtag_outcomes if not already logged for this request
        if (linkedRequestId && Object.keys(metrics).length > 0) {
          const { data: existing } = await db
            .from('hashtag_outcomes')
            .select('id')
            .eq('request_id', linkedRequestId)
            .maybeSingle();

          if (!existing) {
            await db.from('hashtag_outcomes').insert({
              request_id:     linkedRequestId,
              user_id,
              views:          metrics.impressions ?? null,
              saves:          metrics.saved       ?? null,
              shares:         metrics.shares      ?? null,
              follows_gained: null, // not available from IG API at post level
              posted_at:      post.timestamp || new Date().toISOString(),
            });
            linked++;
          }
        }

        synced++;
      } catch (postErr) {
        console.warn(`Skipped post ${post.id}:`, postErr);
      }
    }

    // Update last_synced_at
    await db
      .from('instagram_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connectionId);

    console.log(`Sync complete for user ${user_id}: ${synced}/${posts.length} posts synced, ${linked} linked to requests, ${insightsFail} insight failures`);

    return json({ success: true, synced, linked, total: posts.length, insight_failures: insightsFail });

  } catch (err) {
    console.error('Error in instagram-sync:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
