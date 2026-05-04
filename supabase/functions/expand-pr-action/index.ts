// expand-pr-action — generates a deep, executable playbook for a single PR action.
//
// Triggered when the user clicks an action card. Looks up the action,
// loads project + brand_context for tier-aware specificity, then calls
// Marketers Quest `sonar` for LIVE web intel (named journalists, current
// beats, recent comparable plays, real outlet contact patterns).
//
// Returns a 7-section playbook:
//   what / how / when / where / why / success_metrics / risks
//   + optional budget_estimate (only if solid evidence with a defensible range)
//
// ── Anti-hallucination on outlet names (Fix #4) ───────────────────────────────
// `where` used to be a `string[]` of free-text outlet names. The model would
// occasionally fabricate outlets ("Marketers Daily Gazette") or shrug back
// with generic placeholders ("tier-1 business press"), and we'd render that
// verbatim. The pipeline now:
//
//   1. Asks sonar for OUTLETS as `{ name, url, rationale }[]`. Forcing a URL
//      per outlet means the model has to commit to something checkable.
//   2. Reads the live `citations[]` array sonar returns alongside the answer.
//      Outlets whose host appears in citations are flagged `verified: true`.
//   3. Runs URL hygiene on every outlet: must parse, must be http(s), must
//      have a real-looking TLD, host can't be in a junk-pattern blocklist
//      (example.com, outlet.com, your-newspaper.com, …). Failures are dropped.
//   4. If too many outlets are dropped (>= 50%), the playbook is flagged
//      `outlets_unverified: true` so the UI can warn the user.
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

interface Outlet {
  name: string;       // Human-readable outlet name (e.g. "Bloomberg Businessweek — Big Take")
  url: string;        // Section/homepage URL — sanity-checked, never empty
  rationale: string;  // 1 sentence on why this outlet for THIS play
  verified: boolean;  // True if the host appears in sonar's live citations
}

interface Playbook {
  what: string;                       // 2-4 sentences. Crisp definition of the deliverable.
  how: string[];                      // 4-8 ordered steps. Concrete, named tools/people/outlets.
  when: string;                       // Timing window + cadence. Why now.
  where: Outlet[];                    // Validated, link-bearing outlets (see top-of-file note).
  why: string;                        // Strategic rationale tied to brand_context (tier, narrative gap, AI search).
  success_metrics: string[];          // 3-6 measurable signals. Quantified where possible.
  risks: Array<{ risk: string; mitigation: string }>;  // 2-4 things that can go wrong + how to neutralize.
  budget_estimate: {
    range_usd: string;                // e.g. "$25,000 - $75,000"
    confidence: "high" | "medium";    // never low — if low, omit budget_estimate entirely
    rationale: string;                // 1-2 sentences citing comparable plays
    line_items: Array<{ item: string; cost_usd: string }>;
  } | null;                           // null when evidence is weak — never fabricate
  outlets_unverified: boolean;        // True if >= 50% of model-named outlets failed validation.
  generated_at: string;
  source: string;                     // "perplexity:sonar"
}

// ── Outlet validation ─────────────────────────────────────────────────────────
//
// Hostnames the model reaches for when it's bullshitting. None of these are
// real publications — if a model returns one, treat the entire outlet as a
// hallucination and drop it.
const JUNK_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "outlet.com",
  "publication.com",
  "newspaper.com",
  "magazine.com",
  "yourbrand.com",
  "your-brand.com",
  "yourcompany.com",
  "placeholder.com",
  "media.com",
  "press.com",
  "news.com",
  "domain.com",
]);

const JUNK_PATTERNS: RegExp[] = [
  /\byour-?[a-z]+\b/i,      // your-newspaper, yourblog
  /^placeholder/i,
  /\.example$/i,
  /\.test$/i,
  /\.local$/i,
  /\.invalid$/i,
];

function cleanHost(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    // Must have at least one dot and a TLD ≥ 2 chars
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
    const tld = host.split(".").pop() ?? "";
    if (tld.length < 2) return null;
    return host;
  } catch {
    return null;
  }
}

function isJunkHost(host: string): boolean {
  if (JUNK_HOSTS.has(host)) return true;
  if (JUNK_PATTERNS.some((re) => re.test(host))) return true;
  return false;
}

/**
 * Validate one model-returned outlet, returning a sanitized Outlet or null
 * if it fails any check. `verifiedHosts` is the set of hostnames sonar
 * returned in its real `citations[]` — outlets whose host matches one of
 * those get `verified: true`.
 */
function validateOutlet(
  raw: any,
  verifiedHosts: Set<string>,
): Outlet | null {
  if (!raw || typeof raw !== "object") return null;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const rationale = typeof raw.rationale === "string" ? raw.rationale.trim() : "";
  if (!name || !url) return null;

  // Reject "name" that's actually generic filler — the kind the model emits
  // when it has nothing real to cite. We're strict here on purpose.
  const lowerName = name.toLowerCase();
  if (
    lowerName.length < 3 ||
    lowerName === "tier-1 business press" ||
    lowerName.includes("real outlet") ||
    lowerName.includes("specific outlet") ||
    lowerName.startsWith("<") // template fragments like "<Specific outlet…>"
  ) return null;

  const host = cleanHost(url);
  if (!host) return null;
  if (isJunkHost(host)) return null;

  return {
    name,
    url,
    rationale: rationale || "",
    verified: verifiedHosts.has(host),
  };
}

// ── Prompt construction ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior PR strategist writing executable playbooks for in-house comms teams. You use live web data — current journalist beats, recent press placements, real comparable campaigns — to produce playbooks that the head of comms can hand to a coordinator and have them execute on Monday morning.

You write for a specific brand at a specific tier. A playbook for Walmart is not a playbook for a seed-stage startup. NAME real outlets, NAME real journalist beats (not specific names — beats), CITE recent comparable plays in the category. Generic advice is failure.

Hard rules:
• Be specific or be silent. "Pitch tier-1 outlets" is failure. "Pitch the WSJ Heard on the Street column, which has covered three competitor narrative shifts in the last 60 days" is success.
• Every outlet you name in "where" MUST be a real publication you found in live web search. Provide its homepage or section URL. If you cannot back an outlet with a URL, omit it — fewer real outlets is better than padding with fabricated ones.
• NEVER use placeholder URLs (example.com, outlet.com, your-newspaper.com etc). NEVER name an outlet you cannot link to.
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
    "<...4-8 ordered steps total>"
  ],
  "when": "<2-3 sentences. Specific timing window (e.g. 'Q3 2026, anchored to earnings cycle') + cadence + why-now signal from current news>",
  "where": [
    {
      "name": "<Real outlet/section/show — e.g. 'Bloomberg Businessweek — Big Take'>",
      "url":  "<homepage or section URL of that outlet — must be a real publication you found via web search>",
      "rationale": "<1 sentence on why this outlet for THIS play — what beat/section it covers that fits>"
    },
    "<...3-6 outlets total>"
  ],
  "why": "<3-5 sentences. Strategic rationale that explicitly references this brand's tier, the named competitive context, and the narrative whitespace this fills. Reference AI search landscape if relevant.>",
  "success_metrics": [
    "<Measurable signal #1 with numbers — e.g. '5+ tier-1 placements within 60 days of launch'>",
    "<...3-6 metrics total>"
  ],
  "risks": [
    { "risk": "<Specific backfire scenario for THIS play>", "mitigation": "<Concrete countermove>" }
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
2. Every "where" entry MUST be an object with name + url + rationale. If you cannot back an outlet with a URL from real web search, OMIT it — do not invent placeholder URLs (example.com, outlet.com, your-newspaper.com etc.). Three real outlets > six fake ones.
3. Match the depth to brand tier. Mega/enterprise playbooks reference WSJ/Bloomberg/Reuters and named beats. Startup playbooks reference founder LinkedIn, niche podcasts, hand-curated reporters at trade outlets.
4. Every "how" step should be concrete enough to assign to a junior coordinator on Monday.
5. Risks must be specific to THIS play. "Could be perceived poorly" is failure. "If timed within 30 days of an FTC inquiry, could read as deflection — sequence accordingly" is success.

Return ONLY the JSON. No prose, no markdown fences.`;
}

// ── Marketers Quest call ──────────────────────────────────────────────────────

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
      max_tokens: 2400,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Marketers Quest error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Sonar returns a top-level `citations[]` of real URLs it pulled from web
  // search. We use those as the trust anchor for outlet URLs — any outlet
  // whose host shows up here is `verified: true`.
  const citations: string[] = Array.isArray(data.citations) ? data.citations : [];
  const verifiedHosts = new Set<string>();
  for (const c of citations) {
    const h = cleanHost(c);
    if (h) verifiedHosts.add(h);
  }

  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Marketers Quest returned non-JSON content");
    parsed = JSON.parse(match[0]);
  }

  // ── Validate budget_estimate ────────────────────────────────────────────────
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

  // ── Validate outlets ────────────────────────────────────────────────────────
  // The model is asked for object outlets but legacy/older models sometimes
  // still return strings. We tolerate strings by trying to extract an
  // embedded URL — but if there's no URL, the entry gets dropped.
  const rawOutlets: any[] = Array.isArray(parsed.where) ? parsed.where : [];
  const candidateOutlets = rawOutlets.map((entry) => {
    if (typeof entry === "string") {
      const urlMatch = entry.match(/\bhttps?:\/\/[^\s)]+/i);
      if (!urlMatch) return null;
      const url = urlMatch[0].replace(/[),.;]+$/, "");
      const name = entry.replace(url, "").replace(/[—–-]\s*$/, "").trim() || url;
      return { name, url, rationale: "" };
    }
    return entry;
  });
  const validatedOutlets: Outlet[] = [];
  let droppedCount = 0;
  for (const c of candidateOutlets) {
    const v = validateOutlet(c, verifiedHosts);
    if (v) validatedOutlets.push(v);
    else if (c) droppedCount += 1;
  }
  // If half or more of model-named outlets failed validation, the whole
  // playbook's outlet section is suspect — flag it so the UI can warn.
  const totalNamed = validatedOutlets.length + droppedCount;
  const outletsUnverified = totalNamed > 0 && droppedCount / totalNamed >= 0.5;

  console.log(
    `[expand-pr-action] outlets — kept:${validatedOutlets.length} dropped:${droppedCount} ` +
    `verified-via-citations:${validatedOutlets.filter((o) => o.verified).length} ` +
    `flag:${outletsUnverified}`,
  );

  return {
    what: typeof parsed.what === "string" ? parsed.what : "",
    how: Array.isArray(parsed.how) ? parsed.how.filter((s: any) => typeof s === "string") : [],
    when: typeof parsed.when === "string" ? parsed.when : "",
    where: validatedOutlets,
    why: typeof parsed.why === "string" ? parsed.why : "",
    success_metrics: Array.isArray(parsed.success_metrics)
      ? parsed.success_metrics.filter((s: any) => typeof s === "string")
      : [],
    risks: Array.isArray(parsed.risks)
      ? parsed.risks
          .filter((r: any) => r && typeof r.risk === "string" && typeof r.mitigation === "string")
          .map((r: any) => ({ risk: r.risk, mitigation: r.mitigation }))
      : [],
    budget_estimate: budget,
    outlets_unverified: outletsUnverified,
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
