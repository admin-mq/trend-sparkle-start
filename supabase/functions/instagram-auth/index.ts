import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_VERSION = 'v20.0';
const SCOPES = 'instagram_basic,instagram_manage_insights,pages_show_list';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const { action, code, redirect_uri, user_id } = body;

    const appId     = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');

    if (!appId || !appSecret) {
      return json({ error: 'META_APP_ID or META_APP_SECRET not configured. Add these in Supabase Edge Function secrets.' }, 500);
    }

    // ── 1. Return OAuth URL ────────────────────────────────────────────────────
    if (action === 'initiate') {
      if (!redirect_uri) return json({ error: 'redirect_uri is required' }, 400);
      const authUrl = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${SCOPES}&response_type=code`;
      return json({ url: authUrl });
    }

    // ── 2. Handle OAuth callback — exchange code for tokens ───────────────────
    if (action === 'callback') {
      if (!code || !redirect_uri || !user_id) {
        return json({ error: 'code, redirect_uri, and user_id are required' }, 400);
      }

      // Exchange code for short-lived token
      const shortResp = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${code}`
      );
      const shortData = await shortResp.json();
      if (shortData.error) throw new Error(`Token exchange failed: ${shortData.error.message}`);
      const shortToken = shortData.access_token;

      // Exchange for long-lived token (60-day)
      const longResp = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
      );
      const longData   = await longResp.json();
      const longToken  = longData.access_token || shortToken;
      const expiresIn  = longData.expires_in   || 5_184_000; // 60 days fallback

      // Discover Instagram Business Account from connected Pages
      let igUserId: string | null    = null;
      let igUsername: string | null  = null;
      let igProfilePic: string | null = null;
      let igPageToken: string        = longToken;

      const pagesResp = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/me/accounts?access_token=${longToken}`
      );
      const pagesData = await pagesResp.json();

      if (pagesData.data?.length > 0) {
        for (const page of pagesData.data) {
          const pageToken = page.access_token || longToken;
          const igCheckResp = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${page.id}?fields=instagram_business_account&access_token=${pageToken}`
          );
          const igCheckData = await igCheckResp.json();

          if (igCheckData.instagram_business_account?.id) {
            igUserId    = igCheckData.instagram_business_account.id;
            igPageToken = pageToken;
            break;
          }
        }
      }

      // Fallback: use Facebook user ID (personal IG basic display)
      if (!igUserId) {
        const meResp = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/me?fields=id,name&access_token=${longToken}`
        );
        const meData = await meResp.json();
        igUserId  = meData.id;
        igUsername = meData.name;
      } else {
        // Fetch IG profile details
        const profileResp = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${igUserId}?fields=username,profile_picture_url&access_token=${igPageToken}`
        );
        const profileData = await profileResp.json();
        igUsername   = profileData.username    || null;
        igProfilePic = profileData.profile_picture_url || null;
      }

      // Store in DB
      const supabaseUrl       = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const db                = createClient(supabaseUrl, supabaseServiceKey);

      const { error: upsertErr } = await db
        .from('instagram_connections')
        .upsert({
          user_id,
          instagram_user_id:   igUserId,
          username:            igUsername,
          profile_picture_url: igProfilePic,
          access_token:        igPageToken,
          token_type:          'long_lived',
          expires_at:          new Date(Date.now() + expiresIn * 1000).toISOString(),
          connected_at:        new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertErr) throw upsertErr;

      return json({ success: true, username: igUsername });
    }

    // ── 3. Check connection status ─────────────────────────────────────────────
    if (action === 'status') {
      if (!user_id) return json({ error: 'user_id is required' }, 400);
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data } = await db
        .from('instagram_connections')
        .select('id, username, profile_picture_url, connected_at, last_synced_at, expires_at')
        .eq('user_id', user_id)
        .maybeSingle();
      return json({ connected: !!data, connection: data });
    }

    // ── 4. Disconnect ──────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      if (!user_id) return json({ error: 'user_id is required' }, 400);
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await db.from('instagram_connections').delete().eq('user_id', user_id);
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('Error in instagram-auth:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
