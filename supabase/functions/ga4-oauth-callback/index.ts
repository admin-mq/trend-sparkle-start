import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// GA4 OAuth callback — exchanges code for tokens, detects property, stores connection.
// verify_jwt: false  (Google redirects here, no Bearer token)

const GA4_CLIENT_ID = "15288709945-jm6vm0v7bse012dfr19t7iltpkcr4mvg.apps.googleusercontent.com";
const GA4_REDIRECT_URI = "https://njnnpdrevbkhbhzwccuz.supabase.co/functions/v1/ga4-oauth-callback";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  // Decode state first so we always have a return_to
  let state: { site_id?: string; user_id?: string; return_to?: string } = {};
  try { state = JSON.parse(atob(stateRaw || "")); } catch { /* */ }
  const returnTo = state.return_to || "https://marketers-quest.lovable.app/seo";

  if (oauthError || !code) {
    return Response.redirect(`${returnTo}?ga4_error=${encodeURIComponent(oauthError || "no_code")}`);
  }

  const { site_id, user_id } = state;
  if (!site_id || !user_id) {
    return Response.redirect(`${returnTo}?ga4_error=invalid_state`);
  }

  // 1. Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GA4_CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: GA4_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[ga4-oauth] token exchange failed:", err);
    return Response.redirect(`${returnTo}?ga4_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();
  const accessToken: string = tokens.access_token;
  const refreshToken: string = tokens.refresh_token;
  const expiresIn: number = tokens.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // 2. List GA4 account summaries to find the right property
  let propertyId: string | null = null;
  let propertyName: string | null = null;

  try {
    const summaryRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      const accountSummaries = summaryData.accountSummaries || [];

      // Get the site's URL from the DB to match a GA4 property
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: siteRow } = await supabase
        .from("scc_sites")
        .select("site_url")
        .eq("id", site_id)
        .maybeSingle();

      const siteHost = siteRow?.site_url
        ? new URL(siteRow.site_url).hostname.replace(/^www\./, "")
        : null;

      // Walk account summaries → property summaries → find matching by name
      outer:
      for (const account of accountSummaries) {
        for (const prop of account.propertySummaries || []) {
          if (siteHost && prop.displayName?.toLowerCase().includes(siteHost.split(".")[0])) {
            propertyId = prop.property.replace("properties/", "");
            propertyName = prop.displayName;
            break outer;
          }
        }
      }

      // If no match found by name, just pick the first property
      if (!propertyId && accountSummaries.length > 0) {
        const firstProp = accountSummaries[0]?.propertySummaries?.[0];
        if (firstProp) {
          propertyId = firstProp.property.replace("properties/", "");
          propertyName = firstProp.displayName;
        }
      }
    }
  } catch (e) {
    console.warn("[ga4-oauth] property lookup failed:", e);
  }

  // 3. Store connection in DB
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error: upsertErr } = await supabase
    .from("scc_ga4_connections")
    .upsert(
      {
        user_id,
        site_id,
        ga4_property_id: propertyId,
        ga4_property_name: propertyName,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,site_id" },
    );

  if (upsertErr) {
    console.error("[ga4-oauth] DB upsert failed:", upsertErr);
    return Response.redirect(`${returnTo}?ga4_error=db_error`);
  }

  const params = new URLSearchParams({ ga4_connected: "1" });
  if (propertyId) params.set("ga4_property", propertyId);
  if (propertyName) params.set("ga4_name", encodeURIComponent(propertyName));
  return Response.redirect(`${returnTo}?${params.toString()}`);
});
