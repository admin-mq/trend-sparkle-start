import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Load the Instagram access token from app_config
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "INSTAGRAM_ACCESS_TOKEN")
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Instagram access token not configured. Add INSTAGRAM_ACCESS_TOKEN to app_config table." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const accessToken = tokenRow.value;

    // 2. Get the Facebook Page connected to an Instagram Business account
    //    Check app_config for a cached IG business account ID first
    let igBusinessAccountId: string | null = null;

    const { data: cachedId } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "IG_BUSINESS_ACCOUNT_ID")
      .single();

    if (cachedId?.value) {
      igBusinessAccountId = cachedId.value;
    } else {
      // Discover it via /me/accounts
      const pagesRes = await fetch(
        `${GRAPH_API}/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
      );
      const pagesData = await pagesRes.json();

      if (pagesData.error) {
        return new Response(
          JSON.stringify({ error: "Graph API error fetching pages", details: pagesData.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // Find first page with a linked Instagram Business account
      const page = (pagesData.data ?? []).find(
        (p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id
      );

      if (!page) {
        return new Response(
          JSON.stringify({ error: "No Facebook Page with a connected Instagram Business account found. Please connect a Business/Creator IG account to a Facebook Page." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      igBusinessAccountId = page.instagram_business_account.id;

      // Cache it for future calls
      await supabase.from("app_config").upsert({
        key: "IG_BUSINESS_ACCOUNT_ID",
        value: igBusinessAccountId,
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Load all influencers that have an Instagram username
    const { data: influencers, error: infErr } = await supabase
      .from("influencers")
      .select("id, username")
      .not("username", "is", null);

    if (infErr) throw infErr;

    if (!influencers || influencers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No influencers with Instagram usernames found.", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. For each influencer, call the Business Discovery API
    const results: { username: string; status: string; followers?: number; avatar?: string; error?: string }[] = [];

    for (const influencer of influencers) {
      const username = influencer.username.replace(/^@/, "").trim();
      if (!username) continue;

      try {
        const fields = "username,name,followers_count,profile_picture_url,biography,media_count";
        const url = `${GRAPH_API}/${igBusinessAccountId}?fields=business_discovery.fields(${fields})&username=${encodeURIComponent(username)}&access_token=${accessToken}`;

        const igRes = await fetch(url);
        const igData = await igRes.json();

        if (igData.error) {
          results.push({ username, status: "error", error: igData.error.message });
          continue;
        }

        const profile = igData.business_discovery;
        if (!profile) {
          results.push({ username, status: "not_found" });
          continue;
        }

        // Update the influencer record
        const updates: Record<string, string | number> = {};
        if (profile.followers_count != null) updates.followers = profile.followers_count;
        if (profile.profile_picture_url) updates.avatar_url = profile.profile_picture_url;

        if (Object.keys(updates).length > 0) {
          await supabase.from("influencers").update(updates).eq("id", influencer.id);
        }

        results.push({
          username,
          status: "updated",
          followers: profile.followers_count,
          avatar: profile.profile_picture_url ? "set" : "none",
        });
      } catch (err) {
        results.push({ username, status: "error", error: String(err) });
      }

      // Brief pause to stay within Meta rate limits (200 calls/hour per token)
      await new Promise((r) => setTimeout(r, 300));
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const errors = results.filter((r) => r.status === "error").length;

    return new Response(
      JSON.stringify({ message: `Sync complete`, updated, errors, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
