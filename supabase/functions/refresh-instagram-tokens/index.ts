import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_VERSION = 'v21.0';
// Refresh tokens that expire within this many days
const REFRESH_WINDOW_DAYS = 7;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const windowDate = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find connections expiring within the refresh window that haven't expired yet
    const { data: connections, error: fetchErr } = await db
      .from('instagram_connections')
      .select('id, user_id, access_token, expires_at, username')
      .lt('expires_at', windowDate)
      .gt('expires_at', new Date().toISOString());

    if (fetchErr) throw fetchErr;

    if (!connections || connections.length === 0) {
      console.log('[refresh-instagram-tokens] No tokens due for refresh');
      return json({ refreshed: 0, failed: 0, skipped: 0 });
    }

    console.log(`[refresh-instagram-tokens] Found ${connections.length} token(s) to refresh`);

    let refreshed = 0;
    let failed    = 0;

    for (const conn of connections) {
      try {
        const resp = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?grant_type=ig_refresh_token&access_token=${conn.access_token}`
        );
        const data = await resp.json();

        if (data.error) {
          console.warn(`[refresh-instagram-tokens] Failed for user ${conn.user_id} (@${conn.username}): ${data.error.message}`);
          failed++;
          continue;
        }

        await db
          .from('instagram_connections')
          .update({
            access_token: data.access_token,
            expires_at:   new Date(Date.now() + data.expires_in * 1000).toISOString(),
          })
          .eq('id', conn.id);

        console.log(`[refresh-instagram-tokens] Refreshed token for user ${conn.user_id} (@${conn.username}), new expiry in ${Math.round(data.expires_in / 86400)}d`);
        refreshed++;
      } catch (err) {
        console.warn(`[refresh-instagram-tokens] Error refreshing user ${conn.user_id}:`, err);
        failed++;
      }
    }

    return json({ refreshed, failed, total: connections.length });

  } catch (err) {
    console.error('[refresh-instagram-tokens] Fatal error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
