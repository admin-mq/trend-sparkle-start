// expand-pr-action — generates a deep, executable playbook for a single PR action.
//
// Triggered when the user clicks an action card. Looks up the action,
// loads project + brand_context for tier-aware specificity, then calls
// Perplexity `sonar` for LIVE web intel (named journalists, current beats,
// recent comparable plays, real outlet contact patterns).
//
// Returns a 7-section playbook:
//   what / how / when / where / why / success_metrics / risks
//   + optional budget_estimate (only if solid evidence with a defensible range)
//
// Caches to pr_actions.playbook so re-opens are instant. Force-refresh
// supported via { force: true }.

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

interface Playbook {
  what: string;                       // 2-4 sentences. Crisp definition of the deliverable.
  how: string[];                      // 4-8 ordered steps. Concrete, named tools/people/outlets.
  when: string;                       // Timing window + cadence. Why now.
  where: string[];                    // Specific outlets, channels, venues, distribution surfaces.
  why: string;                        // Strategic rationale tied to brand_context (tier, narrative gap, AI search).
  success_metrics: string[];          // 3-6 measurable signals. Quantified where possible.
  risks: Array<{ risk: string; mitigation: string }>;  // 2-4 things that can go wrong + how to neutralize.
  budget_estimate: {
    range_usd: string;                // e.g. "$25,000 - $75,000"
    confidence: "high" | "medium";    // never low — if low, omit budget_estimate entirely
    rationale: string;                // 1-2 sentences citing comparable plays
    line_items: Array<{ item: string; cost_usd: string }>;
  } | null;                           // null when evidence is weak — never fabricate
  generated_at: string;
  source: string;                     // "perplexity:sonar"
}

const SYSTEM_PROMPT = `You are a senior PR strategist writing executable playbooks for in-house comms teams. You use live web data — current journalist beats, recent press placements, real comparable campaigns — to produce playbooks that the head of comms can hand to a coordinator and have them execute on Monday morning.

You write for a specific brand at a specific tier. A playbook for Walmart is not a playbook for a seed-stage startup. NAME real outlets, NAME real journalist beats (not specific names — beats), CITE recent comparable plays in the category. Generic advice is failure.

Hard rules:
• Be specific or be silent. "Pitch tier-1 outlets" is failure. "Pitch the WSJ Heard on the Street column, which has covered three competitor narrative shifts in the last 60 days" is success.
• Budget estimate is OPTIONAL. Only include it if you can cite at least one comparable real-world play with a defensible cost range. If not, return null. NEVER fabricate a budget.
• Risks must be REAL — backfire scenarios specific to this play, not generic "PR can backfire" warnings.
• Success metrics must be MEASURABLE — "5+ tier-1 placements within 60 days", not "increased visibility".
• Every section must reference the brand's actual tier, recent press themes, and competitive context.`;

function buildUserPrompt(args: {
  brand: { name: string; domain: string; industry?: string | null; geography?: string | null };
  brandContext: any | null;
  action: {
    title: string;
    action_type: string | null;
    effort: string | null;
    expected_impact: string | null;
    what_to_do: string | null;
    why_it_matters: string | null;
  };
}) {
  const { brand, brandContext, action } = args;

  const ctxBlock = brandContext
    ? `BRAND CONTEXT (use this to tier the playbook correctly):
• Tier: ${brandContext.tier || "unknown"}${brandContext.tier_rationale ? ` (${brandContext.tier_rationale})` : ""}
• Scale: ${brandContext.approximate_revenue || "unknown revenue"}, ${brandContext.approximate_employees || "unknown employees"}
• Market position: ${brandContext.market_position || "unknown"}
• Primary competitors: ${(brandContext.primary_competitors || []).join(", ") || "unknown"}
• Recent press themes (last 90d): ${(brandContext.recent_press_themes || []).join(" | ") || "unknown"}
• Active PR risks: ${(brandContext.active_pr_risks || []).join(" | ") || "unknown"}
• Open narrative whitespaces: ${(brandContext.open_narrative_whitespaces || []).join(" | ") || "unknown"}
• AI search landscape: ${brandContext.ai_search_landscape_note || "unknown"}`
    : `BRAND CONTEXT: not yet derived. Make conservative assumptions and flag tier uncertainty in the why section.`;

  return `Build an executable playbook for the PR action below.

BRAND: ${brand.name} (${brand.domain})
Industry: ${brand.industry || "(derive)"}
Geography: ${brand.geography || "(derive)"}

${ctxBlock}

ACTION TO EXPAND:
• Title: ${action.title}
• Type: ${action.action_type || "unspecified"}
• Effort: ${action.effort || "unspecified"}
• Expected impact: ${action.expected_impact || "unspecified"}
• Original summary: ${action.what_to_do || "(none)"}
• Original rationale: ${action.why_it_matters || "(none)"}

Return ONLY valid JSON with this exact shape:

{
  "what": "<2-4 sentences. Crisp definition of the deliverable. What artifact gets produced and shipped.>",
  "how": [
    "<Step 1: concrete first move with named tool/person/outlet>",
    "<Step 2: ...>",
    "<Step 3: ...>",
    "<...4-8 ordered steps total>"
  ],
  "when": "<2-3 sentences. Specific timing window (e.g. 'Q3 2026, anchored to earnings cycle') + cadence + why-now signal from current news>",
  "where": [
    "<Specific outlet/channel #1 — e.g. 'Bloomberg Businessweek — Big Take section, which ran a Costco data-drop story last month'>",
    "<Specific outlet/channel #2>",
    "<...3-6 surfaces total>"
  ],
  "why": "<3-5 sentences. Strategic rationale that explicitly references this brand's tier, the named competitive context, and the narrative whitespace this fills. Reference AI search landscape if relevant.>",
  "success_metrics": [
    "<Measurable signal #1 with numbers — e.g. '5+ tier-1 placements within 60 days of launch'>",
    "<Measurable signal #2>",
    "<...3-6 metrics total>"
  ],
  "risks": [
    { "risk": "<Specific backfire scenario for THIS play>", "mitigation": "<Concrete countermove>" },
    { "risk": "<...>", "mitigation": "<...>" }
  ],
  "budget_estimate": {
    "range_usd": "<e.g. '$25,000 - $75,000' — only include if you have solid comparable evidence>",
    "confidence": "high" | "medium",
    "rationale": "<1-2 sentences citing the comparable play(s) that anchor this range>",
    "line_items": [
      { "item": "<e.g. 'Op-ed ghostwriter (senior)'>", "cost_usd": "<e.g. '$5,000 - $15,000'>" }
    ]
  }
}

CRITICAL RULES:
1. budget_estimate: return null (NOT a fabricated number) if you cannot cite a comparable play with defensible numbers. Confidence must be 'high' or 'medium' — if it would be 'low', return null instead.
2. Every "where" entry should NAME a real outlet/section/show/venue. Not "tier-1 business press" — name them.
3. Every "how" step should be concrete enough to assign to a junior coordinator on Monday.
4. Risks must be specific to THIS play. "Could be perceived poorly" is failure. "If timed within 30 days of an FTC inquiry, could read as deflection — sequence accordingly" is success.
5. Match the depth to brand tier. Mega/enterprise playbooks reference WSJ/Bloomberg/Reuters and named beats. Startup playbooks reference founder LinkedIn, niche podcasts, hand-curated reporters at trade outlets.

Return ONLY the JSON. No prose, no markdown fences.`;
}

// ── Perplexity call ───────────────────────────────────────────────────────────

async function callPerplexity(args: Parameters<typeof buildUserPrompt>[0]): Promise<Playbook> {
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
        { role: "user", content: buildUserPrompt(args) },
      ],
      temperature: 0.3,
      max_tokens: 2200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Perplexity error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Perplexity returned non-JSON content");
    parsed = JSON.parse(match[0]);
  }

  // Validate + normalize budget_estimate — drop it if confidence is "low" or
  // if the model returned a placeholder range with no rationale.
  let budget: Playbook["budget_estimate"] = null;
  if (parsed.budget_estimate && typeof parsed.budget_estimate === "object") {
    const be = parsed.budget_estimate;
    const conf = (be.confidence || "").toLowerCase();
    const hasRange = typeof be.range_usd === "string" && be.range_usd.trim().length > 0;
    const hasRationale = typeof be.rationale === "string" && be.rationale.trim().length > 10;
    if ((conf === "high" || conf === "medium") && hasRange && hasRationale) {
      budget = {
        range_usd: be.range_usd,
        confidence: conf as "high" | "medium",
        rationale: be.rationale,
        line_items: Array.isArray(be.line_items) ? be.line_items : [],
      };
    }
  }

  return {
    what: typeof parsed.what === "string" ? parsed.what : "",
    how: Array.isArray(parsed.how) ? parsed.how : [],
    when: typeof parsed.when === "string" ? parsed.when : "",
    where: Array.isArray(parsed.where) ? parsed.where : [],
    why: typeof parsed.why === "string" ? parsed.why : "",
    success_metrics: Array.isArray(parsed.success_metrics) ? parsed.success_metrics : [],
    risks: Array.isArray(parsed.risks)
      ? parsed.risks
          .filter((r: any) => r && typeof r.risk === "string" && typeof r.mitigation === "string")
          .map((r: any) => ({ risk: r.risk, mitigation: r.mitigation }))
      : [],
    budget_estimate: budget,
    generated_at: new Date().toISOString(),
    source: "perplexity:sonar",
  };
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
    const { action_id, force = false } = body;

    if (!action_id) {
      return new Response(JSON.stringify({ error: "action_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load action + project
    const { data: action, error: actionErr } = await supabase
      .from("pr_actions")
      .select("id, project_id, title, action_type, effort, expected_impact, what_to_do, why_it_matters, playbook, playbook_generated_at")
      .eq("id", action_id)
      .single();
    if (actionErr || !action) {
      return new Response(JSON.stringify({ error: "Action not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache hit
    if (!force && action.playbook) {
      return new Response(JSON.stringify({ success: true, playbook: action.playbook, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projErr } = await supabase
      .from("pr_projects")
      .select("brand_name, domain, industry, geography, brand_context")
      .eq("id", action.project_id)
      .single();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[expand-pr-action] Generating playbook for action ${action_id} — ${action.title}`);

    const playbook = await callPerplexity({
      brand: {
        name: project.brand_name,
        domain: project.domain,
        industry: project.industry,
        geography: project.geography,
      },
      brandContext: project.brand_context,
      action: {
        title: action.title,
        action_type: action.action_type,
        effort: action.effort,
        expected_impact: action.expected_impact,
        what_to_do: action.what_to_do,
        why_it_matters: action.why_it_matters,
      },
    });

    // Persist
    const { error: updateErr } = await supabase
      .from("pr_actions")
      .update({
        playbook,
        playbook_generated_at: new Date().toISOString(),
        playbook_source: "perplexity:sonar",
      })
      .eq("id", action_id);
    if (updateErr) throw new Error(`Failed to persist playbook: ${updateErr.message}`);

    return new Response(JSON.stringify({ success: true, playbook, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[expand-pr-action] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
