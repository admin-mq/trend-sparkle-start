import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { influencer_id, username } = await req.json();

    if (!influencer_id || !username) {
      return new Response(
        JSON.stringify({ error: "influencer_id and username are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch the public Instagram profile page server-side.
    // Instagram includes the profile picture in the og:image meta tag for public profiles.
    const igResponse = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });

    const html = await igResponse.text();

    // Extract og:image from the HTML meta tags
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
    const avatarUrl = match?.[1] ?? null;

    if (!avatarUrl) {
      return new Response(
        JSON.stringify({ error: "Could not find profile picture. The account may be private or Instagram blocked the request." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Persist to Supabase using the service role key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await supabase
      .from("influencers")
      .update({ avatar_url: avatarUrl })
      .eq("id", influencer_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ avatar_url: avatarUrl }),
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
