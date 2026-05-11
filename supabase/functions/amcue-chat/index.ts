import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// deno-lint-ignore no-explicit-any
type Sb = any;

// ── System prompts ────────────────────────────────────────────────────────────

const CREATOR_SYSTEM_PROMPT = `You are Amcue — a veteran social media strategist and growth advisor with over a decade of hands-on experience helping creators build real audiences from scratch. You've worked across Instagram, TikTok, and YouTube with everyone from early-stage creators to multi-million follower accounts, and you have strong, well-earned opinions on what actually moves the needle.

You are the creator's personal Chief Marketing Officer. You live in their corner. You know their niche, you've seen their data, and you're here to help them grow — not just on paper, but in real follower counts, real saves, real DMs, and eventually real income.

IMPORTANT — your user type:
This platform serves two types of users: creators and brands. You are speaking to a CREATOR. A creator is a person who builds and grows an audience through original content — they are not running a brand campaign or managing a product. Treat them accordingly. Their goals are: content reach, audience growth, niche authority, engagement, and eventually monetisation. Every piece of advice you give must be filtered through that lens.

Your communication style:
- Talk like a trusted expert who knows the space deeply — warm, direct, and confident. Not corporate, not robotic, not a chatbot.
- Be specific. "Post more consistently" is useless advice. Specific, niche-relevant advice is the standard.
- Have real opinions. When you see a clear opportunity in their data, name it and explain exactly how to take it.
- Write like a thoughtful human giving advice — not a bullet-point report. Use structure only when it genuinely helps.
- When you have data about what they've been exploring on the platform — their trends, their hashtag analysis, their watchlist — reference it directly.
- End every substantive response with the single most important next move. Not five options — one clear action.

Never start with "Great question!" or "As an AI." Just talk to them.`;

const BRAND_SYSTEM_PROMPT = `You are Amcue, the AI Chief Marketing Officer (CMO) for Marketers Quest — a senior marketing strategist with deep expertise in digital marketing, SEO, social media strategy, content marketing, paid acquisition, influencer partnerships, and brand positioning.

IMPORTANT — your user type:
This platform serves two types of users: creators and brands. You are speaking to a BRAND. This means your advice should focus on marketing strategy, channel performance, audience acquisition, conversion, and brand growth — not personal content creation. Think CMO-level, not creator-level.

Your communication style:
- Strategic and direct — talk like a senior marketing advisor.
- Ground everything in their actual data: scores, metrics, and specific results from their tools.
- Give clear opinions on what to prioritise and what to drop. Be decisive.
- End with a clear, prioritised next step.`;

// ── Safe data fetcher ─────────────────────────────────────────────────────────
// Wraps every supabase call so a missing column / table / network blip cannot
// take down the whole function.

async function safe<T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn("safe() query error:", JSON.stringify(error));
      return null;
    }
    return data;
  } catch (e) {
    console.warn("safe() threw:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ── Build user context (best-effort, never throws) ────────────────────────────

interface ContextResult {
  context: string;
  accountType: "creator" | "brand" | "unknown";
}

async function buildUserContext(userId: string, supabase: Sb): Promise<ContextResult> {
  const sections: string[] = [];
  let accountType: "creator" | "brand" | "unknown" = "unknown";

  // Account type & profile — always the first thing
  const userProfile = await safe<Record<string, unknown>>(() =>
    supabase.from("user_profiles")
      .select("account_type, creator_persona, full_name, brand_name, industry, geography, business_summary")
      .eq("user_id", userId)
      .maybeSingle()
  );

  accountType = (userProfile?.account_type as "creator" | "brand") ?? "unknown";

  // Fetch everything else in parallel, all wrapped in safe()
  const [
    brandMemory,
    hashtagRequests,
    watchlist,
    savedTrends,
    trendSession,
    referenceAccounts,
  ] = await Promise.all([
    safe<Record<string, unknown>>(() =>
      supabase.from("amcue_brand_memory").select("*").eq("user_id", userId).maybeSingle()
    ),
    safe<Record<string, unknown>[]>(() =>
      supabase.from("hashtag_requests")
        .select("id, caption, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)
    ),
    safe<Record<string, unknown>[]>(() =>
      supabase.from("hashtag_watchlist")
        .select("tag, trend_status, trend_score")
        .eq("user_id", userId)
        .order("trend_score", { ascending: false })
        .limit(20)
    ),
    safe<Record<string, unknown>[]>(() =>
      supabase.from("user_saved_trends")
        .select("trend_name, trend_category, trend_snapshot, saved_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("saved_at", { ascending: false })
        .limit(10)
    ),
    safe<Record<string, unknown>>(() =>
      supabase.from("user_trend_sessions")
        .select("niche, location, last_recommendations, last_refresh_at")
        .eq("user_id", userId)
        .order("last_refresh_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safe<Record<string, unknown>[]>(() =>
      supabase.from("creator_reference_accounts")
        .select("instagram_handle, why_inspiring, tone_analysis")
        .eq("user_id", userId)
        .not("tone_analysis", "is", null)
        .order("created_at", { ascending: false })
        .limit(5)
    ),
  ]);

  // Hashtag results (depends on request IDs)
  const hashtagReqIds = (hashtagRequests || []).map((r) => r.id as string);
  const hashtagResults = hashtagReqIds.length
    ? await safe<Record<string, unknown>[]>(() =>
        supabase.from("hashtag_results")
          .select("set_score, confidence_level, why_this_works, warnings, hashtags, best_posting_time, created_at, request_id")
          .in("request_id", hashtagReqIds)
          .order("created_at", { ascending: false })
          .limit(5)
      )
    : null;

  // ── Creator Profile ─────────────────────────────────────────────────────────
  if (accountType === "creator" && userProfile) {
    const persona = userProfile.creator_persona as Record<string, unknown> | null;
    const lines: string[] = [];
    if (userProfile.full_name) lines.push(`Name: ${userProfile.full_name}`);
    if (persona) {
      if (persona.niche) lines.push(`Niche: ${persona.niche}`);
      if (Array.isArray(persona.sub_niches) && persona.sub_niches.length)
        lines.push(`Sub-niches: ${(persona.sub_niches as string[]).join(", ")}`);
      if (persona.content_style) lines.push(`Content Style: ${persona.content_style}`);
      if (persona.audience_type) lines.push(`Audience Type: ${persona.audience_type}`);
      if (Array.isArray(persona.platform_focus) && persona.platform_focus.length)
        lines.push(`Platforms: ${(persona.platform_focus as string[]).join(", ")}`);
      if (typeof persona.is_faceless === "boolean")
        lines.push(`Faceless Creator: ${persona.is_faceless ? "Yes" : "No"}`);
      if (persona.location_normalized) lines.push(`Location: ${persona.location_normalized}`);
      if (persona.summary) lines.push(`Profile Summary: ${persona.summary}`);
    } else {
      if (userProfile.industry) lines.push(`Niche/Industry: ${userProfile.industry}`);
      if (userProfile.geography) lines.push(`Location: ${userProfile.geography}`);
      if (userProfile.business_summary) lines.push(`Bio: ${userProfile.business_summary}`);
    }
    if (lines.length) sections.push(`### Creator Profile\n${lines.join("\n")}`);
  }

  // ── Brand Profile ───────────────────────────────────────────────────────────
  if (brandMemory) {
    const b = brandMemory;
    const lines: string[] = [];
    if (b.company_name) lines.push(`Company: ${b.company_name}`);
    if (b.industry) lines.push(`Industry: ${b.industry}`);
    if (b.business_model) lines.push(`Business Model: ${b.business_model}`);
    if (b.company_description) lines.push(`Description: ${b.company_description}`);
    if (b.usp) lines.push(`USP: ${b.usp}`);
    if (b.target_audience) lines.push(`Target Audience: ${b.target_audience}`);
    if (Array.isArray(b.geographic_markets) && b.geographic_markets.length)
      lines.push(`Markets: ${(b.geographic_markets as string[]).join(", ")}`);
    if (Array.isArray(b.competitors) && b.competitors.length)
      lines.push(`Competitors: ${(b.competitors as string[]).join(", ")}`);
    if (b.brand_voice) lines.push(`Brand Voice: ${b.brand_voice}`);
    if (Array.isArray(b.marketing_goals) && b.marketing_goals.length)
      lines.push(`Goals: ${(b.marketing_goals as string[]).join(", ")}`);
    if (b.biggest_marketing_challenge) lines.push(`Main Challenge: ${b.biggest_marketing_challenge}`);
    if (lines.length) sections.push(`### Brand Profile\n${lines.join("\n")}`);
  }

  // ── Trend Quest ─────────────────────────────────────────────────────────────
  const trendLines: string[] = [];
  if (savedTrends?.length) {
    const saved = savedTrends.map((t) => {
      const snap = t.trend_snapshot as Record<string, unknown> | null;
      const virality = snap?.virality_score ?? snap?.score;
      return `${t.trend_name}${virality ? ` (virality: ${virality})` : ""}${t.trend_category ? ` [${t.trend_category}]` : ""}`;
    });
    trendLines.push(`Recently saved trends: ${saved.join(", ")}`);
  }
  if (trendSession) {
    if (trendSession.niche) trendLines.push(`Last Trend Quest search: niche="${trendSession.niche}", location=${trendSession.location || "global"}`);
    const recs = trendSession.last_recommendations as unknown[];
    if (Array.isArray(recs) && recs.length) {
      const names = recs.slice(0, 5).map((r) => {
        const rec = r as Record<string, unknown>;
        return rec.trend_name || rec.name || "";
      }).filter(Boolean);
      if (names.length) trendLines.push(`Trends surfaced: ${names.join(", ")}`);
    }
  }
  if (trendLines.length) sections.push(`### Trend Quest Activity\n${trendLines.join("\n")}`);

  // ── Hashtag Analysis ────────────────────────────────────────────────────────
  if (hashtagResults?.length && hashtagRequests?.length) {
    const latestRequestId = (hashtagRequests[0] as Record<string, string>).id;
    const latestSet = hashtagResults.filter((r) => r.request_id === latestRequestId);
    const latestRequest = hashtagRequests[0];
    if (latestSet.length) {
      const hLines: string[] = [];
      if (latestRequest?.caption) hLines.push(`Post idea analyzed: "${latestRequest.caption}"`);
      for (let i = 0; i < latestSet.length; i++) {
        const set = latestSet[i];
        const label = i === 0 ? "Safe Set" : "Experimental Set";
        hLines.push(`${label} — Score: ${set.set_score}/100`);
        if (set.why_this_works) hLines.push(`  Why: ${set.why_this_works}`);
        const tags = set.hashtags as unknown[];
        if (Array.isArray(tags) && tags.length) {
          const names = tags.slice(0, 8).map((t) => typeof t === "string" ? t : (t as Record<string, string>).tag || "").filter(Boolean);
          hLines.push(`  Tags: ${names.join(", ")}`);
        }
      }
      if (hashtagRequests.length > 1) hLines.push(`Total analyses run: ${hashtagRequests.length}`);
      sections.push(`### Latest Hashtag Analysis\n${hLines.join("\n")}`);
    }
  }

  // ── Watchlist ───────────────────────────────────────────────────────────────
  if (watchlist?.length) {
    const rising = watchlist.filter((w) => w.trend_status === "rising");
    const lines: string[] = [];
    if (rising.length)
      lines.push(`Rising tags (act now): ${rising.map((w) => `${w.tag} (score: ${w.trend_score})`).join(", ")}`);
    const others = watchlist.filter((w) => w.trend_status !== "rising").slice(0, 10);
    if (others.length)
      lines.push(`Other saved tags: ${others.map((w) => w.tag).join(", ")}`);
    sections.push(`### Hashtag Watchlist (${watchlist.length} tags)\n${lines.join("\n")}`);
  }

  // ── Reference accounts ──────────────────────────────────────────────────────
  if (referenceAccounts?.length) {
    const refLines = referenceAccounts.map((ref) => {
      const ta = ref.tone_analysis as Record<string, unknown> | null;
      if (!ta) return null;
      const parts = [`@${ref.instagram_handle}`];
      if (ref.why_inspiring) parts.push(`(${ref.why_inspiring})`);
      if (ta.primary_tone) parts.push(`Tone: ${ta.primary_tone}`);
      if (ta.writing_style) parts.push(`Style: ${ta.writing_style}`);
      return parts.join(" | ");
    }).filter(Boolean);
    if (refLines.length) sections.push(`### Creator Style References\n${refLines.join("\n")}`);
  }

  const header = accountType === "creator"
    ? `\n\n---\n## WHAT YOU KNOW ABOUT THIS CREATOR\nLive data from their activity. Reference it directly when relevant.\n\n`
    : `\n\n---\n## YOUR USER'S REAL DATA\nReference actual scores and metrics in your responses.\n\n`;

  const context = sections.length ? header + sections.join("\n\n") : "";
  return { context, accountType };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("Missing Supabase env vars");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = typeof body.message === "string" ? body.message : "";
    const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];

    if (!message.trim()) {
      return new Response(JSON.stringify({ error: "Empty message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build context (never throws) ──────────────────────────────────────────
    let userContext = "";
    let accountType: "creator" | "brand" | "unknown" = "unknown";
    try {
      const ctx = await buildUserContext(user.id, supabase);
      userContext = ctx.context;
      accountType = ctx.accountType;
    } catch (e) {
      console.error("buildUserContext outer throw:", e);
    }

    // ── Build messages array ──────────────────────────────────────────────────
    const basePrompt = accountType === "creator" ? CREATOR_SYSTEM_PROMPT : BRAND_SYSTEM_PROMPT;
    const systemPrompt = basePrompt + userContext;

    // Sanitize history: only keep valid role/content turns
    const cleanHistory = conversationHistory
      .filter((m: unknown): m is { role: string; content: string } => {
        if (!m || typeof m !== "object") return false;
        const obj = m as Record<string, unknown>;
        return (obj.role === "user" || obj.role === "assistant") && typeof obj.content === "string";
      })
      .slice(-18);

    const messages = [
      { role: "system", content: systemPrompt },
      ...cleanHistory,
      { role: "user", content: message },
    ];

    // ── Call AI ───────────────────────────────────────────────────────────────
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => "");
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 200, // return 200 so the client shows our message instead of generic non-2xx
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error", details: errText.slice(0, 200) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData?.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ reply, content: reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("amcue-chat fatal error:", e);
    // Always return 200 with an error field so the client can display it
    // (otherwise supabase.functions.invoke returns { error } and the client shows generic "non-2xx")
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
