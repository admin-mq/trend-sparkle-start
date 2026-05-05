import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// GA4 data fetch — returns key analytics metrics for a connected site.
// verify_jwt: true

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GA4_CLIENT_ID = "15288709945-jm6vm0v7bse012dfr19t7iltpkcr4mvg.apps.googleusercontent.com";

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: string } | null> {
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GA4_CLIENT_ID,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  return { access_token: data.access_token, expires_at: expiresAt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("site_id");
  const days = parseInt(url.searchParams.get("days") || "30", 10);

  if (!siteId) {
    return new Response(JSON.stringify({ error: "site_id required" }), { status: 400, headers: corsHeaders });
  }

  // Load GA4 connection
  const { data: conn, error: connErr } = await supabase
    .from("scc_ga4_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("site_id", siteId)
    .maybeSingle();

  if (connErr || !conn) {
    return new Response(JSON.stringify({ error: "GA4 not connected for this site" }), { status: 404, headers: corsHeaders });
  }

  // Refresh token if expired
  let accessToken: string = conn.access_token;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date(Date.now() + 60_000)) {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    if (refreshed) {
      accessToken = refreshed.access_token;
      await supabase.from("scc_ga4_connections").update({
        access_token: refreshed.access_token,
        token_expires_at: refreshed.expires_at,
        updated_at: new Date().toISOString(),
      }).eq("id", conn.id);
    }
  }

  const propertyId = conn.ga4_property_id;
  if (!propertyId) {
    return new Response(JSON.stringify({ error: "No GA4 property linked. Reconnect to select a property." }), { status: 400, headers: corsHeaders });
  }

  const endDate = "today";
  const startDate = `${days}daysAgo`;

  // Helper to call GA4 Data API
  async function runReport(body: Record<string, unknown>) {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`GA4 API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  try {
    // Fetch all reports in parallel
    const [overviewData, channelData, landingData, deviceData] = await Promise.all([
      // 1. Core overview metrics
      runReport({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "conversions" },
          { name: "newUsers" },
        ],
      }),

      // 2. Sessions by default channel
      runReport({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGrouping" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),

      // 3. Top landing pages
      runReport({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPage" }],
        metrics: [{ name: "sessions" }, { name: "bounceRate" }, { name: "conversions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),

      // 4. Device breakdown
      runReport({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
    ]);

    // Parse overview
    const overviewRow = overviewData.rows?.[0]?.metricValues || [];
    const overview = {
      sessions: parseInt(overviewRow[0]?.value || "0"),
      total_users: parseInt(overviewRow[1]?.value || "0"),
      pageviews: parseInt(overviewRow[2]?.value || "0"),
      bounce_rate: parseFloat((parseFloat(overviewRow[3]?.value || "0") * 100).toFixed(1)),
      avg_session_duration: parseFloat(parseFloat(overviewRow[4]?.value || "0").toFixed(0)),
      conversions: parseInt(overviewRow[5]?.value || "0"),
      new_users: parseInt(overviewRow[6]?.value || "0"),
    };

    // Parse channels
    const channels = (channelData.rows || []).map((row: Record<string, {value: string}[]>) => ({
      channel: row.dimensionValues[0]?.value || "Unknown",
      sessions: parseInt(row.metricValues[0]?.value || "0"),
      users: parseInt(row.metricValues[1]?.value || "0"),
      conversions: parseInt(row.metricValues[2]?.value || "0"),
    }));

    // Parse landing pages
    const landingPages = (landingData.rows || []).map((row: Record<string, {value: string}[]>) => ({
      page: row.dimensionValues[0]?.value || "/",
      sessions: parseInt(row.metricValues[0]?.value || "0"),
      bounce_rate: parseFloat((parseFloat(row.metricValues[1]?.value || "0") * 100).toFixed(1)),
      conversions: parseInt(row.metricValues[2]?.value || "0"),
    }));

    // Parse devices
    const devices = (deviceData.rows || []).map((row: Record<string, {value: string}[]>) => ({
      device: row.dimensionValues[0]?.value || "unknown",
      sessions: parseInt(row.metricValues[0]?.value || "0"),
      users: parseInt(row.metricValues[1]?.value || "0"),
    }));

    return new Response(JSON.stringify({
      property_id: propertyId,
      property_name: conn.ga4_property_name,
      date_range: { start: startDate, end: endDate, days },
      overview,
      channels,
      landing_pages: landingPages,
      devices,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[ga4-fetch] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "GA4 fetch failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
