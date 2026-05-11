import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Pattern detection prompt ──────────────────────────────────────────────────
//
// Goal: find ONE real, specific observation grounded in actual data.
// Not generic advice. Not cheerleading. A signal the creator can act on now.

const NUDGE_PROMPT = `You are Amcue's insight engine. A creator just opened their chat and you have a snapshot of their recent activity on Marketers Quest. Your job is to find ONE specific, non-generic observation they would benefit from knowing right now.

STRICT rules:
- It must be grounded in their ACTUAL data — name a real tag, trend name, or score from the data below
- It must be actionable TODAY or THIS WEEK — not a long-term strategy point
- If there is genuinely nothing interesting in the data (no data at all, or everything looks fine), return null
- Maximum 2 sentences for body: one observation, one implication or what to do about it
- Tone: direct, warm, like a savvy friend who noticed something. No corporate language.

Patterns to look for (in priority order):
1. Rising watchlist tag with no recent post or analysis using it — the window may be closing
2. Trend bookmarked in Trend Quest but no hashtag analysis run for that trend topic
3. Last hashtag analysis is more than 7 days old while the watchlist has active signals
4. Multiple recent analyses with very different niches — scattered content signal
5. A hashtag set scored 80+ but no "I'm using this set" action recorded (chosenSet is null)
6. Saved trends that expire within 24h that haven't been acted on

Return ONLY valid JSON in one of these two forms — no markdown, no explanation:
{ "headline": "...", "body": "...", "cta": "..." }
or
null

Keep headline under 8 words. CTA should be a natural first message to send Amcue, like "Help me post with #tag before it peaks" or "Let's build a plan around the [trend] trend".`;

// ── Fetch creator context (lean version — only signal-rich sources) ───────────

async function fetchCreatorContext(userId: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const [
      { data: profile },
      { data: watchlist },
      { data: savedTrends },
      { data: trendSession },
      { data: recentRequests },
    ] = await Promise.all([
      supabase.from("user_profiles")
        .select("creator_persona, industry, geography")
        .eq("user_id", userId)
        .maybeSingle(),

      supabase.from("hashtag_watchlist")
        .select("tag, trend_status, trend_score, created_at")
        .eq("user_id", userId)
        .order("trend_score", { ascending: false })
        .limit(15),

      supabase.from("user_saved_trends")
        .select("trend_name, trend_category, saved_at, expires_at, trend_snapshot")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("saved_at", { ascending: false })
        .limit(8),

      supabase.from("user_trend_sessions")
        .select("niche, location, last_recommendations, last_refresh_at")
        .eq("user_id", userId)
        .order("last_refresh_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase.from("hashtag_requests")
        .select("id, caption, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const sections: string[] = [];
    const now = new Date();

    // Creator persona (niche context for relevance scoring)
    const persona = profile?.creator_persona as Record<string, unknown> | null;
    if (persona?.niche) sections.push(`Creator niche: ${persona.niche}`);

    // Watchlist with trend momentum
    if (watchlist?.length) {
      const rising = (watchlist as Record<string, unknown>[]).filter((w) => w.trend_status === "rising");
      const total = watchlist.length;
      if (rising.length) {
        sections.push(`Rising watchlist tags (need action): ${rising.map((w) => `${w.tag} (score: ${w.trend_score})`).join(", ")}`);
      }
      sections.push(`Total watchlist tags: ${total}`);
    } else {
      sections.push("Watchlist: empty");
    }

    // Saved trends with expiry urgency
    if (savedTrends?.length) {
      const withUrgency = (savedTrends as Record<string, unknown>[]).map((t) => {
        const expiresAt = new Date(t.expires_at as string);
        const hoursLeft = Math.round((expiresAt.getTime() - now.getTime()) / 3600000);
        const snap = t.trend_snapshot as Record<string, unknown> | null;
        const virality = snap?.virality_score ?? snap?.score;
        return `${t.trend_name}${virality ? ` (virality: ${virality})` : ""} — ${hoursLeft}h left`;
      });
      sections.push(`Bookmarked trends (expires soon first):\n${withUrgency.join("\n")}`);
    } else {
      sections.push("Bookmarked trends: none");
    }

    // Last trend session
    if (trendSession) {
      const ts = trendSession as Record<string, unknown>;
      const lastRefresh = new Date(ts.last_refresh_at as string);
      const daysSince = Math.round((now.getTime() - lastRefresh.getTime()) / 86400000);
      sections.push(`Last Trend Quest session: niche="${ts.niche}", ${daysSince} day(s) ago`);
      const recs = ts.last_recommendations as Record<string, unknown>[] | null;
      if (Array.isArray(recs) && recs.length) {
        const names = recs.slice(0, 4).map((r) => r.trend_name || r.name || "").filter(Boolean);
        if (names.length) sections.push(`Trends shown to creator: ${names.join(", ")}`);
      }
    }

    // Recent hashtag analyses with timing
    if (recentRequests?.length) {
      const reqs = recentRequests as Record<string, unknown>[];
      const mostRecent = new Date(reqs[0].created_at as string);
      const daysSinceAnalysis = Math.round((now.getTime() - mostRecent.getTime()) / 86400000);
      sections.push(`Last hashtag analysis: ${daysSinceAnalysis} day(s) ago — caption: "${reqs[0].caption || "not recorded"}"`);
      sections.push(`Total analyses run: ${reqs.length} (in last 30 days scope)`);

      // Detect niche scatter: pull captions and look for variety
      const captions = reqs.map((r) => r.caption as string).filter(Boolean);
      if (captions.length > 1) sections.push(`Recent analysis captions: ${captions.slice(0, 4).join(" | ")}`);
    } else {
      sections.push("Hashtag analyses: none run yet");
    }

    // Also fetch the latest result to check if any set was chosen
    if (recentRequests?.length) {
      const latestId = (recentRequests[0] as Record<string, string>).id;
      const { data: latestResults } = await supabase
        .from("hashtag_results")
        .select("set_score, set_type, created_at")
        .eq("request_id", latestId)
        .order("set_score", { ascending: false })
        .limit(2);

      if (latestResults?.length) {
        const best = (latestResults as Record<string, unknown>[])[0];
        sections.push(`Best set score from latest analysis: ${best.set_score}/100 (${best.set_type})`);
        // We don't store chosenSet in the DB currently, so flag this as unknown
        sections.push(`Whether creator acted on this analysis: unknown (no 'I'm using this' record found)`);
      }
    }

    return sections.join("\n");
  } catch (e) {
    console.error("fetchCreatorContext error:", e);
    return "";
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ nudge: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ nudge: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only generate nudges for creators
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.account_type !== "creator") {
      return new Response(JSON.stringify({ nudge: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = await fetchCreatorContext(user.id, supabase);
    if (!context) {
      return new Response(JSON.stringify({ nudge: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: NUDGE_PROMPT },
          { role: "user", content: `Creator activity data:\n\n${context}` },
        ],
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({ nudge: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content?.trim() ?? "";

    let nudge = null;
    if (raw && raw !== "null") {
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        nudge = JSON.parse(cleaned);
        // Validate shape
        if (!nudge?.headline || !nudge?.body || !nudge?.cta) nudge = null;
      } catch {
        nudge = null;
      }
    }

    return new Response(JSON.stringify({ nudge }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("amcue-nudge error:", e);
    return new Response(JSON.stringify({ nudge: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
