import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `You are Amcue, the AI Chief Marketing Officer (CMO) for Marketers Quest. You are an expert in digital marketing, SEO, social media strategy, content marketing, paid advertising, influencer marketing, PR, and brand strategy.

Your personality:
- Professional but approachable
- Data-driven and strategic
- Proactive with actionable recommendations
- You speak in clear, concise marketing language
- You reference real marketing frameworks and best practices

When users ask about their website or marketing:
- Give specific, actionable advice based on their real data provided below
- Reference their actual scores, metrics, and results when relevant
- Suggest metrics to track
- Recommend tools and strategies
- Create frameworks and plans when asked

Keep responses concise but thorough. Use bullet points and structure for readability. Always end with a clear next step or action item.`;

const EXTRACT_SYSTEM_PROMPT = `You are a brand data extractor. Given a user message in a marketing chat, extract any brand or company information the user mentions. Return ONLY a valid JSON object — no markdown, no explanation. Only include fields where the information is clearly stated. Omit fields not mentioned (do not include them at all, not even as null).

Fields to extract (use exact key names):
- company_name (string)
- company_description (string)
- industry (string)
- business_model (string, e.g. B2C, B2B, SaaS, D2C, Marketplace)
- usp (string, unique selling proposition or what makes them different)
- target_audience (string)
- geographic_markets (array of strings, countries or regions)
- products_services (string, what they sell)
- marketing_goals (array of strings)
- biggest_marketing_challenge (string)
- current_channels (object, keys are channel names e.g. "instagram", "google_ads", values are brief descriptions)
- monthly_marketing_budget_usd (number, only if a USD amount is clearly stated)
- average_order_value_usd (number)
- customer_ltv_usd (number)
- competitors (array of strings, competitor brand or company names)
- brand_voice (string, tone/personality description)`;

// ── Build user context from all tools ────────────────────────────────────────

async function buildUserContext(userId: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  const sections: string[] = [];

  try {
    // First round: parallel fetches that don't depend on each other
    const [
      { data: brandMemory },
      { data: prProjects },
      { data: hashtagRequestIds },
      { data: watchlist },
      { data: seoSites },
    ] = await Promise.all([
      supabase.from("amcue_brand_memory").select("*").eq("user_id", userId).maybeSingle(),

      supabase.from("pr_projects")
        .select("id, brand_name, domain")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase.from("hashtag_requests")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),

      supabase.from("hashtag_watchlist")
        .select("tag, trend_status, trend_score, trend_note")
        .eq("user_id", userId)
        .order("trend_score", { ascending: false })
        .limit(20),

      supabase.from("scc_sites")
        .select("id, site_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    // Second round: fetches that depend on IDs from round 1
    const prProjectIds = (prProjects || []).map((p: Record<string, string>) => p.id);
    const hashtagReqIds = (hashtagRequestIds || []).map((r: Record<string, string>) => r.id);
    const seoSiteId = seoSites?.[0]?.id;

    const [
      { data: prResult },
      { data: hashtagResult },
      { data: seoSnapshot },
    ] = await Promise.all([
      prProjectIds.length
        ? supabase.from("pr_narrative_results")
            .select("narrative_score, authority_score, proof_density_score, risk_score, opportunity_score, executive_summary, proof_gaps, recommended_actions, pages_analyzed, created_at, project_id")
            .in("project_id", prProjectIds)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      hashtagReqIds.length
        ? supabase.from("hashtag_results")
            .select("set_score, confidence_level, why_this_works, warnings, hashtags, best_posting_time, created_at")
            .in("request_id", hashtagReqIds)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      seoSiteId
        ? supabase.from("scc_snapshots")
            .select("id, finished_at, created_at")
            .eq("site_id", seoSiteId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ── Format: Brand Profile ─────────────────────────────────────────────────
    if (brandMemory) {
      const b = brandMemory as Record<string, unknown>;
      const lines: string[] = [];
      if (b.company_name) lines.push(`Company: ${b.company_name}`);
      if (b.industry) lines.push(`Industry: ${b.industry}`);
      if (b.business_model) lines.push(`Business Model: ${b.business_model}`);
      if (b.company_description) lines.push(`Description: ${b.company_description}`);
      if (b.usp) lines.push(`USP: ${b.usp}`);
      if (b.target_audience) lines.push(`Target Audience: ${b.target_audience}`);
      if (Array.isArray(b.geographic_markets) && b.geographic_markets.length)
        lines.push(`Markets: ${b.geographic_markets.join(", ")}`);
      if (Array.isArray(b.competitors) && b.competitors.length)
        lines.push(`Competitors: ${b.competitors.join(", ")}`);
      if (b.brand_voice) lines.push(`Brand Voice: ${b.brand_voice}`);
      if (b.monthly_marketing_budget_usd)
        lines.push(`Monthly Budget: $${Number(b.monthly_marketing_budget_usd).toLocaleString()}`);
      if (Array.isArray(b.marketing_goals) && b.marketing_goals.length)
        lines.push(`Goals: ${b.marketing_goals.join(", ")}`);
      if (b.biggest_marketing_challenge)
        lines.push(`Main Challenge: ${b.biggest_marketing_challenge}`);
      if (b.products_services) lines.push(`Products/Services: ${b.products_services}`);
      if (lines.length) sections.push(`### Brand Profile\n${lines.join("\n")}`);
    }

    // ── Format: PR Campaign Results ───────────────────────────────────────────
    if (prResult) {
      const pr = prResult as Record<string, unknown>;
      const project = (prProjects || []).find((p: Record<string, string>) => p.id === pr.project_id);
      const lines: string[] = [
        `Brand/Domain: ${(project as Record<string, string>)?.brand_name || "unknown"} (${(project as Record<string, string>)?.domain || ""})`,
        `Narrative Score: ${pr.narrative_score}/100`,
        `Authority Score: ${pr.authority_score}/100`,
        `Proof Density Score: ${pr.proof_density_score}/100`,
        `Risk Score: ${pr.risk_score}/100`,
        `Opportunity Score: ${pr.opportunity_score}/100`,
        `Pages Analyzed: ${pr.pages_analyzed}`,
      ];
      if (pr.executive_summary) lines.push(`Executive Summary: ${pr.executive_summary}`);

      const gaps = pr.proof_gaps as unknown[];
      if (Array.isArray(gaps) && gaps.length) {
        const topGaps = gaps.slice(0, 3).map((g) =>
          typeof g === "string" ? g : (g as Record<string, string>).gap || (g as Record<string, string>).title || JSON.stringify(g)
        );
        lines.push(`Top Proof Gaps: ${topGaps.join("; ")}`);
      }

      const actions = pr.recommended_actions as unknown[];
      if (Array.isArray(actions) && actions.length) {
        const topActions = actions.slice(0, 3).map((a) =>
          typeof a === "string" ? a : (a as Record<string, string>).action || (a as Record<string, string>).title || JSON.stringify(a)
        );
        lines.push(`Top Recommended Actions: ${topActions.join("; ")}`);
      }

      sections.push(`### PR Campaign Results (${new Date(pr.created_at as string).toLocaleDateString()})\n${lines.join("\n")}`);
    }

    // ── Format: SEO ───────────────────────────────────────────────────────────
    if (seoSites?.[0] && seoSnapshot) {
      const snap = seoSnapshot as Record<string, string>;
      const date = snap.finished_at || snap.created_at;
      sections.push(`### SEO\nSite: ${seoSites[0].site_url}\nLast crawl completed: ${new Date(date).toLocaleDateString()}`);
    } else if (seoSites?.[0]) {
      sections.push(`### SEO\nSite connected: ${seoSites[0].site_url} (no completed crawl yet)`);
    }

    // ── Format: Hashtag Analysis ──────────────────────────────────────────────
    if (hashtagResult) {
      const h = hashtagResult as Record<string, unknown>;
      const lines: string[] = [
        `Set Score: ${h.set_score}/100`,
        `Confidence: ${h.confidence_level}`,
      ];
      if (h.why_this_works) lines.push(`Why It Works: ${h.why_this_works}`);
      if (h.best_posting_time) lines.push(`Best Posting Time: ${h.best_posting_time}`);

      const hashtags = h.hashtags as unknown[];
      if (Array.isArray(hashtags) && hashtags.length) {
        const tagList = hashtags.slice(0, 10).map((t) =>
          typeof t === "string" ? t : (t as Record<string, string>).tag || (t as Record<string, string>).name || JSON.stringify(t)
        );
        lines.push(`Hashtags: ${tagList.join(", ")}`);
      }

      const warnings = h.warnings as unknown[];
      if (Array.isArray(warnings) && warnings.length)
        lines.push(`Warnings: ${warnings.slice(0, 2).join("; ")}`);

      sections.push(`### Latest Hashtag Analysis (${new Date(h.created_at as string).toLocaleDateString()})\n${lines.join("\n")}`);
    }

    // ── Format: Hashtag Watchlist ─────────────────────────────────────────────
    if (watchlist?.length) {
      const rising = (watchlist as Record<string, unknown>[]).filter((w) => w.trend_status === "rising");
      const plateauing = (watchlist as Record<string, unknown>[]).filter((w) => w.trend_status === "plateauing");
      const declining = (watchlist as Record<string, unknown>[]).filter((w) => w.trend_status === "declining");

      const lines: string[] = [];
      if (rising.length) lines.push(`Rising: ${rising.map((w) => `${w.tag} (${w.trend_score})`).join(", ")}`);
      if (plateauing.length) lines.push(`Plateauing: ${plateauing.map((w) => w.tag).join(", ")}`);
      if (declining.length) lines.push(`Declining: ${declining.map((w) => w.tag).join(", ")}`);

      sections.push(`### Hashtag Watchlist (${watchlist.length} tags)\n${lines.join("\n")}`);
    }
  } catch (e) {
    console.error("buildUserContext error:", e);
  }

  if (!sections.length) return "";
  return `\n\n---\n## YOUR USER'S REAL DATA\nUse this data to give specific, personalised advice. Reference actual scores and metrics in your responses.\n\n${sections.join("\n\n")}`;
}

// ── Brand info extraction from chat ──────────────────────────────────────────

async function extractBrandInfo(
  userMessage: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<void> {
  try {
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EXTRACT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!extractResponse.ok) return;

    const extractData = await extractResponse.json();
    const raw = extractData.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const extracted: Record<string, unknown> = JSON.parse(cleaned);

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) return;

    await supabase.from("amcue_brand_memory").upsert(
      { user_id: userId, ...updates, last_updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  } catch (e) {
    console.error("Brand extraction error:", e);
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, message, context_page } = await req.json();

    let convId = conversation_id;

    if (!convId) {
      const title = message.length > 50 ? message.substring(0, 50) + "..." : message;
      const { data: conv, error: convErr } = await supabase
        .from("amcue_conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    await supabase.from("amcue_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
      context_page,
    });

    // Fetch history and build user context in parallel
    const [{ data: history }, userContext] = await Promise.all([
      supabase
        .from("amcue_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(20),
      buildUserContext(user.id, supabase),
    ]);

    const systemPrompt = BASE_SYSTEM_PROMPT + userContext;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Run main AI call and brand extraction in parallel
    const [aiResponse] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
        }),
      }),
      extractBrandInfo(message, user.id, supabase, LOVABLE_API_KEY),
    ]);

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    await supabase.from("amcue_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    });

    return new Response(JSON.stringify({
      conversation_id: convId,
      content: reply,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("amcue-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
