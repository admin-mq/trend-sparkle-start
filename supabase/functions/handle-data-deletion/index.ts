import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET') || '';

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

function generateConfirmationCode(input: string): string {
  const safe = input.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `MQ-DEL-${safe || 'REQUEST'}`;
}

async function deleteUserData(supabase: ReturnType<typeof createClient>, userId: string) {
  for (const table of USER_TABLES) {
    try {
      await supabase.from(table).delete().eq('user_id', userId);
    } catch (e) {
      console.warn(`[handle-data-deletion] Could not delete from ${table}:`, e);
    }
  }
  try {
    await supabase.auth.admin.deleteUser(userId);
  } catch (e) {
    console.warn('[handle-data-deletion] Could not delete auth user:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);

    // ── GET: status check page
    if (req.method === 'GET') {
      const code = url.searchParams.get('code') || 'unknown';
      return new Response(
        JSON.stringify({ status: 'processed', confirmation_code: code }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = req.headers.get('content-type') || '';
    console.log('[handle-data-deletion] Content-Type:', contentType);

    // ── Mode 1: Meta signed_request callback (form-encoded)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await req.text();
      const params = new URLSearchParams(body);
      const signedRequest = params.get('signed_request') || '';

      console.log('[handle-data-deletion] Meta callback received, signed_request present:', !!signedRequest);

      // Extract Facebook user_id from payload (without signature verification if no secret)
      let fbUserId = 'unknown';
      try {
        const parts = signedRequest.split('.');
        if (parts.length === 2) {
          let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (payload.length % 4) payload += '=';
          const decoded = atob(payload);
          const data = JSON.parse(decoded);
          if (data.user_id) fbUserId = String(data.user_id);
          console.log('[handle-data-deletion] Decoded fb_user_id:', fbUserId);
        }
      } catch (e) {
        console.warn('[handle-data-deletion] Could not decode signed_request payload:', e);
      }

      // Verify signature if app secret is available
      if (FACEBOOK_APP_SECRET && signedRequest) {
        try {
          const parts = signedRequest.split('.');
          const [encodedSig, encodedPayload] = parts;
          const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(FACEBOOK_APP_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          const expectedSigBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(encodedPayload)
          );
          const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSigBuffer)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          if (expectedSig !== encodedSig) {
            console.warn('[handle-data-deletion] Signature mismatch — request may be invalid');
          } else {
            console.log('[handle-data-deletion] Signature verified OK');
          }
        } catch (e) {
          console.warn('[handle-data-deletion] Signature verification error:', e);
        }
      } else {
        console.warn('[handle-data-deletion] FACEBOOK_APP_SECRET not set — skipping signature verification');
      }

      const confirmationCode = `MQ-FB-${fbUserId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}`;
      const statusUrl = `${SUPABASE_URL}/functions/v1/handle-data-deletion?code=${confirmationCode}`;

      return new Response(
        JSON.stringify({ url: statusUrl, confirmation_code: confirmationCode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Mode 2: In-app deletion (JSON + auth token)
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

  } catch (err) {
    console.error('[handle-data-deletion] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
