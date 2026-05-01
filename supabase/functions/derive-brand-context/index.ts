// derive-brand-context — pulls live web intelligence about a brand to enrich PR scans.
//
// Uses Perplexity `sonar` (live web search + reasoning) to derive:
// • Tier classification (startup / growth / enterprise / mega)
// • Scale signals (revenue, employees, public/private, ticker, founded, HQ)
// • Market position
// • Primary scale-competitors
// • Recent press themes (last 90 days) — heavy weight
// • Active PR risks the brand is currently exposed to
// • Open narrative whitespaces in the category
// • AI search landscape note (who dominates AI answers in this category)
//
// Stored as JSONB on pr_projects.brand_context and consumed by pr-scan synthesis.
// Manual override is supported by the wizard — this function only fills, never overwrites
// fields the user has explicitly edited (when called with merge=true).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandContext {
  tier: "startup" | "growth" | "enterprise" | "mega" | "unknown";
  approximate_revenue: string | null;
  approximate_employees: string | null;
  public_or_private: "public" | "private" | "unknown" | null;
  ticker_symbol: string | null;
  founded_year: number | null;
  headquarters: string | null;
  market_position: string | null;
  primary_competitors: string[];
  recent_press_themes: string[];
  active_pr_risks: string[];
  open_narrative_whitespaces: string[];
  ai_search_landscape_note: string | null;
  tier_rationale: string | null;
  unknown_fields: string[];
  derived_at: string;
  source: "auto" | "manual" | "mixed";
}

const SYSTEM_PROMPT = `You are a senior PR intelligence analyst. You use live web data (news, press releases, financial filings, analyst reports, AI search visibility, social sentiment) to build a brutally honest profile of a brand for a PR strategist.

You are NOT a brand cheerleader. You surface the things a CEO needs to hear, not what they want to hear:
• What's the real story being told about this brand right now?
• What narrative risks are quietly mounting?
• Where are competitors winning the story while this brand sleeps?
• What spaces in the category does no one own?

Be specific, current, and concrete. Cite recency (last 90 days, last 30 days). Never fabricate. If a fact cannot be verified from live web data, return "unknown" for that single field — never make it up.`;

function buildUserPrompt(brand: { name: string; domain: string; industry?: string | null; geography?: string | null }) {
  return `Build a live PR intelligence profile for the brand below.

Brand: ${brand.name}
Domain: ${brand.domain}
Industry hint: ${brand.industry || "(unknown — derive from brand)"}
Geography hint: ${brand.geography || "(unknown — derive from brand)"}

Return ONLY valid JSON with this exact shape. For any field you cannot verify from live web data, return "unknown" for strings, [] for arrays, null for numbers. Do NOT fabricate.

{
  "tier": "startup" | "growth" | "enterprise" | "mega" | "unknown",
  "approximate_revenue": "<e.g. '$640B annual', '~$50M ARR', '$1.2B est.', or 'unknown'>",
  "approximate_employees": "<e.g. '2.1M', '~150', '5,000-10,000', or 'unknown'>",
  "public_or_private": "public" | "private" | "unknown",
  "ticker_symbol": "<e.g. 'WMT' or null>",
  "founded_year": <number or null>,
  "headquarters": "<e.g. 'Bentonville, AR, USA' or 'unknown'>",
  "market_position": "<2-5 words: 'category leader', 'fast-growing challenger', 'niche specialist', 'emerging player', 'embattled incumbent', etc.>",
  "primary_competitors": ["<top 3-5 actual scale-equivalent competitors as domains, e.g. 'amazon.com'>"],
  "recent_press_themes": ["<3-6 dominant themes in PRESS COVERAGE from the LAST 90 DAYS — be SPECIFIC. e.g. 'wage transparency push following walkouts', 'Marketplace expansion vs Amazon Prime', 'AI-driven supply chain pivot'. NOT 'innovation' or 'growth'.>"],
  "active_pr_risks": ["<3-6 specific narrative risks this brand is currently exposed to or managing in 2026 — e.g. 'China supplier human-rights scrutiny', 'CEO succession ambiguity', 'class-action over algorithmic pricing', 'union drives at flagship locations'. Be brutally honest.>"],
  "open_narrative_whitespaces": ["<3-5 specific narrative spaces in this brand's category that NO competitor strongly owns yet — e.g. 'value-led design (Target owns design, no one owns value × design)', 'AI for blue-collar workers (Amazon owns AI for businesses, whitespace exists for consumer)'.>"],
  "ai_search_landscape_note": "<2-3 sentences: which brands DOMINATE AI search responses (ChatGPT, Perplexity, Google AI) for this brand's category in 2026; where this brand currently sits; what's at stake.>",
  "tier_rationale": "<1 sentence justifying tier — e.g. 'Fortune 1 mass retailer, $640B revenue, 2.1M employees → mega.'>"
}

TIER CLASSIFICATION:
• mega: Fortune 500 / >$10B revenue / >10K employees (Walmart, Salesforce, Coca-Cola)
• enterprise: $1B-$10B revenue OR 1K-10K employees (mid-cap public, late-stage scaleups)
• growth: $10M-$1B revenue OR 50-1K employees (Series B-D, profitable SMB)
• startup: <$10M revenue / <50 employees (seed/Series A)

If multiple signals conflict, choose the higher tier. If genuinely unknown, return "unknown".

CRITICAL:
- Use LIVE current data. Cite recency in your reasoning (mentally — output JSON only).
- The recent_press_themes, active_pr_risks, and open_narrative_whitespaces are the MOST VALUABLE fields. Spend the most effort there.
- Be aggressive about what the internet is actually saying — surface the uncomfortable truths.
- Never make up "unknown" facts. Return "unknown" if you cannot verify.

Return ONLY the JSON object. No prose, no markdown fences, no commentary.`;
}

// ── Perplexity call ───────────────────────────────────────────────────────────

async function callPerplexity(brand: { name: string; domain: string; industry?: string | null; geography?: string | null }): Promise<BrandContext> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(brand) },
      ],
      temperature: 0.2,
      max_tokens: 1800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Perplexity error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Strip any accidental markdown code fences
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object via regex
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Perplexity returned non-JSON content");
    parsed = JSON.parse(match[0]);
  }

  // Build unknown_fields array — used by UI to highlight unverified fields in yellow
  const unknown_fields: string[] = [];
  const isUnknown = (v: any) =>
    v === null ||
    v === undefined ||
    (typeof v === "string" && v.toLowerCase().trim() === "unknown") ||
    (Array.isArray(v) && v.length === 0);

  const trackable: (keyof BrandContext)[] = [
    "tier",
    "approximate_revenue",
    "approximate_employees",
    "public_or_private",
    "ticker_symbol",
    "founded_year",
    "headquarters",
    "market_position",
    "primary_competitors",
    "recent_press_themes",
    "active_pr_risks",
    "open_narrative_whitespaces",
    "ai_search_landscape_note",
  ];

  for (const k of trackable) {
    if (isUnknown(parsed[k])) unknown_fields.push(k);
  }

  // Normalize "unknown" string variants → null/empty for storage
  const normalize = (v: any) => {
    if (typeof v === "string" && v.toLowerCase().trim() === "unknown") return null;
    return v;
  };

  return {
    tier: (parsed.tier && parsed.tier !== "unknown" ? parsed.tier : "unknown") as BrandContext["tier"],
    approximate_revenue: normalize(parsed.approximate_revenue) ?? null,
    approximate_employees: normalize(parsed.approximate_employees) ?? null,
    public_or_private: normalize(parsed.public_or_private) ?? null,
    ticker_symbol: normalize(parsed.ticker_symbol) ?? null,
    founded_year: typeof parsed.founded_year === "number" ? parsed.founded_year : null,
    headquarters: normalize(parsed.headquarters) ?? null,
    market_position: normalize(parsed.market_position) ?? null,
    primary_competitors: Array.isArray(parsed.primary_competitors) ? parsed.primary_competitors : [],
    recent_press_themes: Array.isArray(parsed.recent_press_themes) ? parsed.recent_press_themes : [],
    active_pr_risks: Array.isArray(parsed.active_pr_risks) ? parsed.active_pr_risks : [],
    open_narrative_whitespaces: Array.isArray(parsed.open_narrative_whitespaces) ? parsed.open_narrative_whitespaces : [],
    ai_search_landscape_note: normalize(parsed.ai_search_landscape_note) ?? null,
    tier_rationale: normalize(parsed.tier_rationale) ?? null,
    unknown_fields,
    derived_at: new Date().toISOString(),
    source: "auto",
  };
}

// ── Manual-edit-aware merge ───────────────────────────────────────────────────
// When merge=true, preserves any field the user manually edited
// (existing context with source='manual' or 'mixed' wins on changed fields).

function mergeWithExisting(fresh: BrandContext, existing: BrandContext | null): BrandContext {
  if (!existing) return fresh;
  // If the user hasn't manually edited anything, just return the new auto context
  if (existing.source === "auto") return fresh;

  // Otherwise: keep manual values where they exist, fill rest from fresh
  // We treat any non-null/non-empty existing value as user-confirmed
  const merged: BrandContext = { ...fresh };
  for (const k of Object.keys(fresh) as (keyof BrandContext)[]) {
    if (k === "derived_at" || k === "source" || k === "unknown_fields") continue;
    const ev = (existing as any)[k];
    const isEmpty = ev === null || ev === undefined || (Array.isArray(ev) && ev.length === 0) ||
      (typeof ev === "string" && ev.trim() === "");
    if (!isEmpty) (merged as any)[k] = ev;
  }
  merged.source = "mixed";
  // Recompute unknown_fields against the merged result
  merged.unknown_fields = fresh.unknown_fields.filter((f) => {
    const v = (merged as any)[f];
    return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
  });
  return merged;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { project_id, brand_name, domain, industry, geography, merge = true } = body;

    let projectRow: any = null;
    let brand = { name: brand_name, domain, industry, geography };

    // Load project for brand info + existing context (if project_id provided)
    if (project_id) {
      const { data: proj, error } = await supabase
        .from("pr_projects")
        .select("id, brand_name, domain, industry, geography, brand_context")
        .eq("id", project_id)
        .single();
      if (error || !proj) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      projectRow = proj;
      brand = {
        name: proj.brand_name,
        domain: proj.domain,
        industry: proj.industry,
        geography: proj.geography,
      };
    }

    if (!brand.name || !brand.domain) {
      return new Response(JSON.stringify({ error: "brand_name and domain required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[derive-brand-context] Deriving for: ${brand.name} (${brand.domain})`);
    const fresh = await callPerplexity(brand);

    const final = merge && projectRow?.brand_context
      ? mergeWithExisting(fresh, projectRow.brand_context as BrandContext)
      : fresh;

    // Persist if we have a project_id
    if (project_id) {
      const { error: updateErr } = await supabase
        .from("pr_projects")
        .update({
          brand_context: final,
          brand_context_updated_at: new Date().toISOString(),
        })
        .eq("id", project_id);
      if (updateErr) throw new Error(`Failed to persist brand_context: ${updateErr.message}`);
    }

    return new Response(JSON.stringify({ success: true, brand_context: final }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[derive-brand-context] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
