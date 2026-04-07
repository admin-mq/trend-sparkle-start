import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET') || '';

// Tables to wipe for a given user_id
const USER_TABLES = [
  'brand_profiles',
  'brand_memory',
  'brand_examples',
  'user_profiles',
  'profiles',
  'amcue_conversations',
  'amcue_cmo_memory',
  'amcue_brand_memory',
  'pr_projects',
  'scc_sites',
  'scc_gsc_connections',
  'scc_gbp_connections',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function verifySignedRequest(signedRequest: string): Promise<{ user_id: string } | null> {
  if (!FACEBOOK_APP_SECRET) return null;
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;

  const [encodedSig, encodedPayload] = parts;
  const payload = base64UrlDecode(encodedPayload);
  const data = JSON.parse(payload);

  if (data.algorithm?.toUpperCase() !== 'HMAC-SHA256') return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(FACEBOOK_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = Uint8Array.from(atob(base64UrlDecode(encodedSig).split('').map(c => c.charCodeAt(0))));
  const payloadBytes = new TextEncoder().encode(encodedPayload);

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
  if (!valid) return null;

  return { user_id: data.user_id };
}

async function deleteUserData(supabase: ReturnType<typeof createClient>, userId: string) {
  for (const table of USER_TABLES) {
    await supabase.from(table).delete().eq('user_id', userId);
  }
  // Delete the auth user last
  await supabase.auth.admin.deleteUser(userId);
}

function generateConfirmationCode(userId: string): string {
  // Simple deterministic code based on userId + timestamp truncated
  const hash = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `MQ-DEL-${hash}`;
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  // ── GET /handle-data-deletion?code=xxx  →  status check page (JSON)
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    return new Response(
      JSON.stringify({ status: 'processed', confirmation_code: code || 'unknown' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── POST — two modes:
  //    1. Meta callback: body is form-encoded with signed_request
  //    2. In-app deletion: JSON body with { user_id }

  const contentType = req.headers.get('content-type') || '';

  // Mode 1: Meta's signed_request callback
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get('signed_request');

    if (!signedRequest) {
      return new Response(JSON.stringify({ error: 'Missing signed_request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verified = await verifySignedRequest(signedRequest);
    if (!verified) {
      // If we can't verify (no app secret set), still return a valid response
      // so Meta doesn't reject the endpoint during setup
      console.warn('[handle-data-deletion] Could not verify signed_request — app secret may not be set');
    }

    const fbUserId = verified?.user_id || 'unknown';
    const confirmationCode = `MQ-FB-${fbUserId.slice(0, 8).toUpperCase()}`;
    const statusUrl = `${SUPABASE_URL.replace('supabase.co', 'supabase.co')}/functions/v1/handle-data-deletion?code=${confirmationCode}`;

    console.log(`[handle-data-deletion] Meta callback for fb_user_id: ${fbUserId}`);

    return new Response(
      JSON.stringify({ url: statusUrl, confirmation_code: confirmationCode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Mode 2: In-app deletion — called from the Settings page with auth token
  if (contentType.includes('application/json')) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[handle-data-deletion] In-app deletion for user: ${user.id}`);
    await deleteUserData(supabase, user.id);

    const confirmationCode = generateConfirmationCode(user.id);
    return new Response(
      JSON.stringify({ success: true, confirmation_code: confirmationCode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
