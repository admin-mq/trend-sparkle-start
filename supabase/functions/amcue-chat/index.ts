import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Creator system prompt ─────────────────────────────────────────────────────

const CREATOR_SYSTEM_PROMPT = `You are Amcue — a veteran social media strategist and growth advisor with over a decade of hands-on experience helping creators build real audiences from scratch. You've worked across Instagram, TikTok, and YouTube with everyone from early-stage creators to multi-million follower accounts, and you have strong, well-earned opinions on what actually moves the needle.

You are the creator's personal Chief Marketing Officer. You live in their corner. You know their niche, you've seen their data, and you're here to help them grow — not just on paper, but in real follower counts, real saves, real DMs, and eventually real income.

IMPORTANT — your user type:
This platform serves two types of users: creators and brands. You are speaking to a CREATOR. A creator is a person who builds and grows an audience through original content — they are not running a brand campaign or managing a product. Treat them accordingly. Their goals are: content reach, audience growth, niche authority, engagement, and eventually monetisation. Every piece of advice you give must be filtered through that lens.

Your communication style:
- Talk like a trusted expert who knows the space deeply — warm, direct, and confident. Not corporate, not robotic, not a chatbot.
- Be specific. "Post more consistently" is useless advice. "You're in the [niche] space — that audience saves educational carousels on Tuesdays through Thursdays, not Reels on weekends. Here's exactly what I'd test this week" — that's the standard.
- Have real opinions. When you see a mistake, say it plainly. When you see a clear opportunity in their data, name it and explain exactly how to take it.
- Write like a thoughtful human giving advice — not a bullet-point report. Use structure only when it genuinely helps. Never pad. Never start with "Great question!" or "As an AI." Just talk to them.
- When you have data about what they've been exploring on the platform — their trends, their hashtag analysis, their watchlist — reference it directly. Make them feel like you've been paying attention, not like you're reading from a file.
- End every substantive response with the single most important next move. Not five options — one clear action.

What you understand deeply:
- How the Instagram algorithm actually distributes content: the role of shares and saves vs. likes, the first-hour window, the importance of send rate, and why follower count means less than engagement rate for reach.
- Hashtag strategy in the current landscape: when it matters for discoverability, what "niche saturation" means in practice, how hashtag tiers work, and when to ignore hashtags entirely.
- Trend timing: the difference between catching a trend in its early spike (days 1–4) vs. joining it late (day 8+). Why relevance to the creator's niche matters more than raw virality.
- Content formats and hooks: what gets saved, what gets shared, what gets DMs. Why saves signal content depth, why shares signal content emotion, and why watch time still matters more than anything.
- Niche positioning: why most creators grow slowly because they're too broad. How to find a specific enough niche to dominate a corner, then expand. The "go narrow to go wide" principle.
- The creator growth flywheel: discoverability → right-audience fit → trust → engagement → monetisation. Where most creators get stuck and why.
- Audience building vs. follower buying: why vanity metrics kill real growth. How to read engagement rate as the real health signal.

What you never do:
- Give generic "post 3 times a week" advice unless you have a specific reason tied to their niche and audience behaviour.
- Recommend chasing every trend — trend relevance to their niche and brand identity matters more than any virality score.
- Treat the creator like a brand manager. They are building a personal media presence, not running ad campaigns.
- Overwhelm them. One clear, actionable insight beats ten vague suggestions every single time.
- Pretend to be certain when you're not. If you don't have enough data to make a call, say so and tell them what information would help you give better advice.`;

// ── Brand system prompt ───────────────────────────────────────────────────────

const BRAND_SYSTEM_PROMPT = `You are Amcue, the AI Chief Marketing Officer (CMO) for Marketers Quest — a senior marketing strategist with deep expertise in digital marketing, SEO, social media strategy, content marketing, paid acquisition, influencer partnerships, and brand positioning.

IMPORTANT — your user type:
This platform serves two types of users: creators and brands. You are speaking to a BRAND. This means your advice should focus on marketing strategy, channel performance, audience acquisition, conversion, and brand growth — not personal content creation. Think CMO-level, not creator-level.

Your communication style:
- Strategic and direct — talk like a senior marketing advisor, not a consultant writing a deck.
- Ground everything in their actual data: scores, metrics, and specific results from their tools.
- Give clear opinions on what to prioritise and what to drop. Be decisive.
- No generic frameworks for the sake of it. Every recommendation must connect to their specific situation.
- End with a clear, prioritised next step.

Your expertise spans:
- Performance marketing, SEO, and organic growth channels
- Brand narrative, authority-building, and positioning
- Campaign strategy and marketing funnel optimisation
- Competitive analysis and market positioning
- Social media strategy at a brand level (campaigns, partnerships, paid)`;

// ── Brand info extraction from chat ──────────────────────────────────────────

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

// ── Build user context ────────────────────────────────────────────────────────

interface ContextResult {
  context: string;
  accountType: "creator" | "brand" | "unknown";
}

async function buildUserContext(userId: string, supabase: ReturnType<typeof createClient>): Promise<ContextResult> {
  const sections: string[] = [];
  let accountType: "creator" | "brand" | "unknown" = "unknown";

  try {
    // Round 1: parallel fetches
    const [
      { data: userProfile },
      { data: brandMemory },
      { data: prProjects },
      { data: hashtagRequests },
      { data: watchlist },
      { data: seoSites },
      { data: referenceAccounts },
      { data: savedTrends },
      { data: trendSession },
    ] = await Promise.all([
      supabase.from("user_profiles")
        .select("account_type, creator_persona, full_name, brand_name, industry, geography, business_summary, primary_goal, creator_niche")
        .eq("user_id", userId)
        .maybeSingle(),

      supabase.from("amcue_brand_memory")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),

      supabase.from("pr_projects")
        .select("id, brand_name, domain")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase.from("hashtag_requests")
        .select("id, caption, created_at")
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
        .order("created_at", { ascending: false }),

      supabase.from("creator_reference_accounts")
        .select("instagram_handle, display_name, why_inspiring, tone_analysis")
        .eq("user_id", userId)
        .not("tone_analysis", "is", null)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase.from("user_saved_trends")
        .select("trend_name, trend_category, trend_snapshot, saved_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("saved_at", { ascending: false })
        .limit(10),

      supabase.from("user_trend_sessions")
        .select("niche, location, last_recommendations, last_refresh_at")
        .eq("user_id", userId)
        .order("last_refresh_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Determine account type early — everything below may branch on it
    accountType = (userProfile?.account_type as "creator" | "brand") ?? "unknown";

    // Round 2: hashtag results (depend on IDs from round 1)
    const prProjectIds = (prProjects || []).map((p: Record<string, string>) => p.id);
    const hashtagReqIds = (hashtagRequests || []).map((r: Record<string, string>) => r.id);
    const seoSiteId = seoSites?.[0]?.id;

    const [
      { data: prResult },
      { data: hashtagResults },
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
            .select("set_score, confidence_level, set_type, why_this_works, warnings, hashtags, best_posting_time, created_at, request_id")
            .in("request_id", hashtagReqIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),

      seoSiteId
        ? supabase.from("scc_snapshots")
            .select("id, finished_at, created_at, notes, market, industry, business_name, currency_symbol, value_per_visitor, estimated_monthly_traffic, total_monthly_loss_min, total_monthly_loss_max, competitor_domains, competitor_traffic_gap_min, competitor_traffic_gap_max, executive_summary, confidence_score, safe_browsing_threat")
            .eq("site_id", seoSiteId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ── Creator Persona ───────────────────────────────────────────────────────
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
        // Fall back to raw profile fields
        if (userProfile.creator_niche || userProfile.industry)
          lines.push(`Niche/Industry: ${userProfile.creator_niche || userProfile.industry}`);
        if (userProfile.geography) lines.push(`Location: ${userProfile.geography}`);
        if (userProfile.business_summary) lines.push(`Bio: ${userProfile.business_summary}`);
        if (userProfile.primary_goal) lines.push(`Primary Goal: ${userProfile.primary_goal}`);
      }

      if (lines.length)
        sections.push(`### Creator Profile\n${lines.join("\n")}`);
    }

    // ── Brand Profile (brand users) ───────────────────────────────────────────
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
        lines.push(`Markets: ${(b.geographic_markets as string[]).join(", ")}`);
      if (Array.isArray(b.competitors) && b.competitors.length)
        lines.push(`Competitors: ${(b.competitors as string[]).join(", ")}`);
      if (b.brand_voice) lines.push(`Brand Voice: ${b.brand_voice}`);
      if (b.monthly_marketing_budget_usd)
        lines.push(`Monthly Budget: $${Number(b.monthly_marketing_budget_usd).toLocaleString()}`);
      if (Array.isArray(b.marketing_goals) && b.marketing_goals.length)
        lines.push(`Goals: ${(b.marketing_goals as string[]).join(", ")}`);
      if (b.biggest_marketing_challenge)
        lines.push(`Main Challenge: ${b.biggest_marketing_challenge}`);
      if (b.products_services) lines.push(`Products/Services: ${b.products_services}`);
      if (lines.length) sections.push(`### Brand Profile\n${lines.join("\n")}`);
    }

    // ── Trend Quest Activity ──────────────────────────────────────────────────
    const trendLines: string[] = [];

    // Saved/bookmarked trends (active within 48h)
    if (savedTrends?.length) {
      const saved = (savedTrends as Record<string, unknown>[]).map((t) => {
        const snap = t.trend_snapshot as Record<string, unknown> | null;
        const virality = snap?.virality_score ?? snap?.score;
        return `${t.trend_name}${virality ? ` (virality: ${virality})` : ""}${t.trend_category ? ` [${t.trend_category}]` : ""}`;
      });
      trendLines.push(`Recently saved trends (bookmarked for content): ${saved.join(", ")}`);
    }

    // Last trend session: what niche/location the recommendations were for + the actual recommendations
    if (trendSession) {
      const ts = trendSession as Record<string, unknown>;
      if (ts.niche) trendLines.push(`Last Trend Quest search: niche = "${ts.niche}", location = ${ts.location || "global"}`);
      const recs = ts.last_recommendations as unknown[];
      if (Array.isArray(recs) && recs.length) {
        const recNames = recs.slice(0, 5).map((r) => {
          const rec = r as Record<string, unknown>;
          return rec.trend_name || rec.name || "";
        }).filter(Boolean);
        if (recNames.length)
          trendLines.push(`Trend recommendations surfaced: ${recNames.join(", ")}`);
      }
    }

    if (trendLines.length)
      sections.push(`### Trend Quest Activity\n${trendLines.join("\n")}`);

    // ── Hashtag Analysis (recent set) ─────────────────────────────────────────
    if (hashtagResults?.length) {
      const results = hashtagResults as Record<string, unknown>[];

      // Group by request_id to show the safe + experimental pair for the latest analysis
      const latestRequestId = (hashtagRequests?.[0] as Record<string, string> | undefined)?.id;
      const latestSet = results.filter((r) => r.request_id === latestRequestId);
      const latestRequest = (hashtagRequests as Record<string, unknown>[] | null)?.[0];

      if (latestSet.length) {
        const hLines: string[] = [];
        if (latestRequest?.caption)
          hLines.push(`Post idea analyzed: "${latestRequest.caption}"`);
        hLines.push(`Analyzed: ${new Date(latestSet[0].created_at as string).toLocaleDateString()}`);

        for (const set of latestSet) {
          const setLabel = set.set_type === "safe" ? "Safe Reach Set" : "Experimental Set";
          hLines.push(`${setLabel} — Score: ${set.set_score}/100 (${set.confidence_level} confidence)`);
          if (set.why_this_works) hLines.push(`  Why it works: ${set.why_this_works}`);
          if (set.best_posting_time) hLines.push(`  Best posting time: ${set.best_posting_time}`);
          const tags = set.hashtags as unknown[];
          if (Array.isArray(tags) && tags.length) {
            const tagNames = tags.slice(0, 8).map((t) =>
              typeof t === "string" ? t : (t as Record<string, string>).tag || ""
            ).filter(Boolean);
            hLines.push(`  Tags: ${tagNames.join(", ")}`);
          }
          const warnings = set.warnings as unknown[];
          if (Array.isArray(warnings) && warnings.length)
            hLines.push(`  Warnings: ${(warnings as string[]).slice(0, 2).join("; ")}`);
        }

        // Mention how many total analyses they've run (context for patterns)
        if ((hashtagRequests?.length ?? 0) > 1)
          hLines.push(`Total analyses run: ${hashtagRequests?.length}`);

        sections.push(`### Latest Hashtag Analysis\n${hLines.join("\n")}`);
      }
    }

    // ── Hashtag Watchlist ─────────────────────────────────────────────────────
    if (watchlist?.length) {
      const wl = watchlist as Record<string, unknown>[];
      const rising = wl.filter((w) => w.trend_status === "rising");
      const plateauing = wl.filter((w) => w.trend_status === "plateauing");
      const declining = wl.filter((w) => w.trend_status === "declining");
      const untracked = wl.filter((w) => !w.trend_status);

      const lines: string[] = [];
      if (rising.length)
        lines.push(`Rising tags (act now): ${rising.map((w) => `${w.tag} (score: ${w.trend_score})`).join(", ")}`);
      if (plateauing.length)
        lines.push(`Plateauing (use with care): ${plateauing.map((w) => w.tag).join(", ")}`);
      if (declining.length)
        lines.push(`Declining (consider dropping): ${declining.map((w) => w.tag).join(", ")}`);
      if (untracked.length)
        lines.push(`Saved tags: ${untracked.map((w) => w.tag).join(", ")}`);

      sections.push(`### Hashtag Watchlist (${watchlist.length} tags)\n${lines.join("\n")}`);
    }

    // ── Creator Style References ──────────────────────────────────────────────
    if (referenceAccounts?.length) {
      const refLines = (referenceAccounts as Record<string, unknown>[]).map((ref) => {
        const ta = ref.tone_analysis as Record<string, unknown> | null;
        if (!ta) return null;
        const parts = [`@${ref.instagram_handle}`];
        if (ref.why_inspiring) parts.push(`(why inspiring: ${ref.why_inspiring})`);
        if (ta.primary_tone) parts.push(`Tone: ${ta.primary_tone}${ta.secondary_tone ? ` + ${ta.secondary_tone}` : ""}`);
        if (ta.writing_style) parts.push(`Style: ${ta.writing_style}`);
        if (Array.isArray(ta.content_themes) && ta.content_themes.length)
          parts.push(`Themes: ${(ta.content_themes as string[]).join(", ")}`);
        if (ta.what_to_borrow) parts.push(`What to borrow: ${ta.what_to_borrow}`);
        return parts.join(" | ");
      }).filter(Boolean);

      if (refLines.length)
        sections.push(`### Creator Style References\nAccounts this creator looks up to — use as style signals when suggesting content:\n${refLines.join("\n")}`);
    }

    // ── PR Campaign Results (brand-relevant) ──────────────────────────────────
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

    // ── SEO Analysis ──────────────────────────────────────────────────────────
    if (seoSites?.[0] && seoSnapshot) {
      const snap = seoSnapshot as Record<string, unknown>;
      const date = (snap.finished_at || snap.created_at) as string;
      const sym = (snap.currency_symbol as string) || "$";
      const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n));

      const lines: string[] = [
        `Site: ${seoSites[0].site_url}`,
        `Last crawl: ${new Date(date).toLocaleDateString()}`,
      ];
      if (snap.business_name) lines.push(`Business: ${snap.business_name}`);
      if (snap.market) lines.push(`Market: ${snap.market}`);
      if (snap.industry) lines.push(`Industry (SEO-detected): ${snap.industry}`);
      if (snap.safe_browsing_threat) lines.push(`⚠️ Google Safe Browsing threat detected — site traffic is being blocked`);
      const lossMin = Number(snap.total_monthly_loss_min || 0);
      const lossMax = Number(snap.total_monthly_loss_max || lossMin);
      if (lossMin > 0) {
        const lossStr = lossMax > lossMin ? `${sym}${fmt(lossMin)}–${sym}${fmt(lossMax)}` : `${sym}${fmt(lossMin)}`;
        lines.push(`Estimated Monthly Revenue Loss from SEO Issues: ${lossStr}/mo`);
      }
      if (snap.estimated_monthly_traffic) lines.push(`Estimated Monthly Traffic: ${Number(snap.estimated_monthly_traffic).toLocaleString()} visits`);
      if (snap.value_per_visitor) lines.push(`Value per Visitor: ${sym}${Number(snap.value_per_visitor).toFixed(2)}`);
      if (snap.executive_summary) lines.push(`SEO Executive Summary: ${snap.executive_summary}`);
      if (Array.isArray(snap.competitor_domains) && (snap.competitor_domains as string[]).length) {
        lines.push(`Top SEO Competitors: ${(snap.competitor_domains as string[]).join(", ")}`);
        const gMin = Number(snap.competitor_traffic_gap_min || 0);
        const gMax = Number(snap.competitor_traffic_gap_max || gMin);
        if (gMin > 0) {
          const gapStr = gMax > gMin ? `${sym}${fmt(gMin)}–${sym}${fmt(gMax)}` : `${sym}${fmt(gMin)}`;
          lines.push(`Monthly Revenue Flowing to Competitors: ${gapStr}/mo`);
        }
      }
      try {
        const notesRaw = typeof snap.notes === "string" ? snap.notes : JSON.stringify(snap.notes ?? "{}");
        const notes = JSON.parse(notesRaw);
        const topIssues = Array.isArray(notes?.top_issues) ? notes.top_issues : [];
        if (topIssues.length)
          lines.push(`Top SEO Issues: ${topIssues.slice(0, 5).map((i: Record<string, unknown>) => `${i.label} (${i.count})`).join(", ")}`);
        const focusAreas = Array.isArray(notes?.focus_areas) ? notes.focus_areas : [];
        if (focusAreas.length)
          lines.push(`Priority Focus Areas: ${(focusAreas as string[]).slice(0, 4).join("; ")}`);
      } catch { /* ignore */ }

      sections.push(`### SEO Analysis\n${lines.join("\n")}`);
    } else if (seoSites?.[0]) {
      sections.push(`### SEO\nSite connected: ${seoSites[0].site_url} (no completed crawl yet)`);
    }

  } catch (e) {
    console.error("buildUserContext error:", e);
  }

  const contextHeader = accountType === "creator"
    ? `\n\n---\n## WHAT YOU KNOW ABOUT THIS CREATOR\nThis is live data from their activity on Marketers Quest. Use it to make your advice specific to them — reference their niche, their actual hashtag scores, the trends they've been exploring. Don't just summarise this data back at them; use it as your briefing.\n\n`
    : `\n\n---\n## YOUR USER'S REAL DATA\nUse this data to give specific, personalised advice. Reference actual scores and metrics in your responses.\n\n`;

  const context = sections.length ? contextHeader + sections.join("\n\n") : "";
  return { context, accountType };
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
    const [{ data: history }, { context: userContext, accountType }] = await Promise.all([
      supabase
        .from("amcue_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(20),
      buildUserContext(user.id, supabase),
    ]);

    // Select the right system prompt based on account type
    const basePrompt = accountType === "creator" ? CREATOR_SYSTEM_PROMPT : BRAND_SYSTEM_PROMPT;
    const systemPrompt = basePrompt + userContext;

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
