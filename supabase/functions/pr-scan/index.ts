import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Page fetching ──────────────────────────────────────────────────────────────

/**
 * Strip noise (scripts, styles, ads) but KEEP more of the actual content.
 * We raise the cap to 8000 chars so AI sees real proof/trust signals.
 */
function stripHtml(html: string, maxChars = 8000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxChars);
}

/**
 * Discover internal links from a page's HTML.
 * Returns paths scored by how strategically valuable they are for PR analysis.
 */
function discoverInternalLinks(html: string, baseDomain: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"'#?]+)["']/gi)]
    .map((m) => m[1])
    .filter(Boolean);

  const internal: string[] = [];
  for (const href of hrefs) {
    try {
      let path: string;
      if (href.startsWith("http")) {
        const u = new URL(href);
        const base = new URL(baseDomain.startsWith("http") ? baseDomain : `https://${baseDomain}`);
        if (u.hostname !== base.hostname) continue;
        path = u.pathname;
      } else if (href.startsWith("/")) {
        path = href;
      } else {
        continue;
      }
      if (path === "/" || path.length < 2) continue;
      internal.push(path);
    } catch {
      // skip
    }
  }

  // Score paths by PR/narrative relevance — higher = more important to fetch
  const scoreMap: Record<string, number> = {};
  const HIGH = 10;
  const MED = 5;
  const LOW = 2;

  const highKeywords = ["about", "mission", "values", "story", "team", "leadership", "founder", "case-stud", "testimonial", "review", "press", "newsroom", "media", "award", "certif", "trust", "proof", "customer", "success", "impact", "sustainab", "responsibility", "esg"];
  const medKeywords = ["service", "product", "solution", "platform", "feature", "pricing", "faq", "support", "help", "blog", "resource", "insight", "why", "how", "compare", "partner"];

  for (const path of internal) {
    const p = path.toLowerCase();
    let score = LOW;
    if (highKeywords.some((k) => p.includes(k))) score = HIGH;
    else if (medKeywords.some((k) => p.includes(k))) score = MED;
    scoreMap[path] = score;
  }

  // Deduplicate and sort by score, take top candidates
  const unique = [...new Set(Object.keys(scoreMap))].sort((a, b) => (scoreMap[b] ?? 0) - (scoreMap[a] ?? 0));
  return unique.slice(0, 20); // return top 20 candidates for caller to pick from
}

async function fetchPage(url: string, maxChars = 8000): Promise<{ url: string; text: string; html?: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NarrativeOS/2.0; +https://narrativeos.com/bot)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html, maxChars);
    if (text.length < 80) return null;
    return { url, text, html };
  } catch {
    return null;
  }
}

/**
 * Smart domain crawl:
 * 1. Fetch homepage and discover internal links
 * 2. Fetch the most strategically valuable pages found
 * 3. Always include a set of fallback paths
 */
async function fetchDomainPages(
  domain: string,
  maxBrandPages = 12,
  maxCompetitorPages = 5
): Promise<{ url: string; text: string }[]> {
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;

  // Step 1: fetch homepage (keep HTML for link discovery)
  const homepage = await fetchPage(base + "/", 8000);
  const results: { url: string; text: string }[] = [];
  const seenPaths = new Set<string>(["/"]);

  if (homepage) {
    results.push({ url: homepage.url, text: homepage.text });

    // Step 2: discover valuable internal links
    const discoveredPaths = discoverInternalLinks(homepage.html || "", base);

    // Step 3: always try these high-value fallback paths (if not already discovered)
    const fallbacks = [
      "/about", "/about-us", "/our-story", "/team", "/leadership",
      "/values", "/mission", "/why-us",
      "/case-studies", "/case-study", "/customers", "/success-stories",
      "/testimonials", "/reviews",
      "/press", "/newsroom", "/media", "/news",
      "/faq", "/help", "/support",
      "/services", "/solutions", "/products",
      "/blog", "/insights", "/resources",
      "/sustainability", "/responsibility", "/impact",
    ];

    const allPaths = [...new Set([...discoveredPaths, ...fallbacks])].filter(
      (p) => !seenPaths.has(p)
    );

    const maxToFetch = maxBrandPages - 1; // -1 for homepage
    const pathsToFetch = allPaths.slice(0, Math.min(maxToFetch * 2, 30)); // fetch more, take successful

    // Step 4: fetch in parallel (batches of 6 to avoid overwhelming)
    const batchSize = 6;
    for (let i = 0; i < pathsToFetch.length && results.length < maxBrandPages; i += batchSize) {
      const batch = pathsToFetch.slice(i, i + batchSize);
      const fetched = await Promise.all(batch.map((p) => fetchPage(base + p, 8000)));
      for (const f of fetched) {
        if (f && results.length < maxBrandPages) {
          results.push({ url: f.url, text: f.text });
        }
      }
    }
  } else {
    // homepage failed — try a few fallback paths directly
    const fallbacks = ["/about", "/services", "/blog", "/faq"];
    const fetched = await Promise.all(fallbacks.map((p) => fetchPage(base + p, 8000)));
    for (const f of fetched) {
      if (f) results.push({ url: f.url, text: f.text });
    }
  }

  return results.slice(0, maxBrandPages);
}

// ── AI Analysis — multi-stage pipeline ────────────────────────────────────────

/**
 * Stage 1: Lightweight per-page extraction.
 * Pulls out exactly what IS present on each page as structured facts.
 * We run this in parallel on all pages using gpt-4o-mini (fast + cheap).
 */
async function extractPageFacts(page: { url: string; text: string }): Promise<string> {
  const prompt = `You are reading a single web page and extracting PR-relevant facts.

Page URL: ${page.url}
Page content:
---
${page.text}
---

Extract ONLY what is explicitly present on this page. Do not infer or guess.
Return a compact bullet-point summary covering:
- What claims or value propositions appear
- Any social proof found (testimonials, reviews, ratings, customer quotes, number of customers/users)
- Any case studies or success stories found
- Any statistics, data, or third-party validation found
- Any awards, certifications, press mentions, or media coverage found
- Any FAQ or help/support content found
- Any trust signals (guarantees, security badges, compliance, accreditations)
- Tone and positioning (e.g. premium, affordable, enterprise, consumer, sustainable)
- Key themes or narratives being pushed

If a category has nothing, write "None found". Keep each bullet under 20 words.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 400,
    }),
  });
  if (!res.ok) return `[extraction failed for ${page.url}]`;
  const d = await res.json();
  return `[${page.url}]\n${d.choices[0].message.content}`;
}

/**
 * Stage 2: Strategic synthesis across all extracted page facts.
 * Uses gpt-4o and is strictly evidence-grounded — no hallucination.
 */
async function synthesizeAnalysis(
  project: any,
  brandFacts: string[],
  competitorFacts: Record<string, string[]>,
  externalMentions: any[] = []
): Promise<any> {
  const brandEvidence = brandFacts.join("\n\n");

  const competitorBlocks = Object.entries(competitorFacts)
    .map(([domain, facts]) => `=== COMPETITOR: ${domain} ===\n${facts.join("\n\n")}`)
    .join("\n\n");

  // Format external mentions for the synthesis prompt
  const mentionsBlock = externalMentions.length > 0
    ? externalMentions.map((m) => {
        const label: Record<string, string> = {
          article: "PRESS ARTICLE", review_site: "REVIEW SITE",
          roundup: "ROUNDUP / BEST-OF", competitor_review: "COMPETITOR REVIEW",
          social: "SOCIAL / FORUM", other: "EXTERNAL SOURCE",
        };
        const quotes = Array.isArray(m.key_quotes) && m.key_quotes.length > 0
          ? m.key_quotes.map((q: any) => `  "${q.quote}" (${q.context})`).join("\n")
          : "  None";
        const proofs = Array.isArray(m.proof_signals) && m.proof_signals.length > 0
          ? m.proof_signals.join("; ") : "None";
        return `[${label[m.source_type] ?? "EXTERNAL"}] ${m.url}
Sentiment toward ${project.brand_name}: ${m.sentiment} (${m.sentiment_score}/100)
Themes: ${Array.isArray(m.themes) ? m.themes.join(", ") : "none"}
Proof signals: ${proofs}
Key quotes:\n${quotes}
Summary: ${m.ai_summary ?? ""}`;
      }).join("\n\n")
    : null;

  const system = `You are a world-class PR strategist and brand narrative analyst with 20+ years experience advising Fortune 500 companies and scaling startups.

You are given structured evidence extracted from a brand's actual website pages and competitor pages.

CRITICAL RULES:
1. Every finding MUST be directly evidenced by the content provided. Never invent, infer, or guess.
2. If the evidence shows something IS present (e.g. testimonials, FAQ, case studies), you MUST NOT report it as missing.
3. If you cannot find evidence of something, only flag it as a gap if its absence genuinely matters for this brand's PR position.
4. Be specific to THIS brand — reference actual claims, actual page content, actual competitive dynamics.
5. Think at a strategic advisory level. Go beyond surface observations. Ask: what does this brand's narrative architecture tell us about their competitive positioning?
6. Write like McKinsey, not like a generic AI tool.`;

  const user = `Analyze the narrative intelligence for ${project.brand_name} (${project.domain}).

Industry: ${project.industry || "Not specified"}
Geography: ${project.geography || "Global"}
Target Audience: ${project.target_audience || "Not specified"}

=== EVIDENCE FROM ${project.brand_name.toUpperCase()} WEBSITE (${brandFacts.length} pages) ===
${brandEvidence || "No pages could be fetched."}

=== EVIDENCE FROM COMPETITOR WEBSITES ===
${competitorBlocks || "No competitor pages fetched."}
${mentionsBlock ? `\n=== EXTERNAL THIRD-PARTY MENTIONS (${externalMentions.length} sources) ===
These are press articles, review sites, roundups, or other third-party pages about this brand.
Third-party sources are high-trust signals — weight them heavily for authority_score and proof_density_score.

${mentionsBlock}` : ""}

Based ONLY on this evidence, return a JSON object with this exact structure:

{
  "narrative_score": <integer 0-100: strength and consistency of the brand's core narrative based on what you actually read>,
  "authority_score": <integer 0-100: how credible and authoritative they actually appear from the evidence>,
  "proof_density_score": <integer 0-100: how much concrete proof actually backs their claims in the evidence>,
  "risk_score": <integer 0-100: genuine risks visible in the evidence — higher = more risk>,
  "opportunity_score": <integer 0-100: how much untapped PR/trust opportunity exists given what's missing or weak>,
  "executive_summary": "<4-5 sentences: what this brand's actual narrative position is right now, key strengths grounded in evidence, specific competitive risks, and the single highest-leverage opportunity. Reference real things you found.>",
  "brand_narratives": [
    {
      "theme": "<specific theme name grounded in what you read — e.g. 'Everyday Low Price Leadership', 'Omnichannel Convenience'>",
      "strength": <integer 0-100>,
      "description": "<1-2 sentences referencing actual content found that supports this theme>",
      "status": "<'strong' | 'emerging' | 'weak' | 'missing'>"
    }
  ],
  "competitor_narratives": {
    "<competitor_domain>": [
      {
        "theme": "<theme name grounded in competitor evidence>",
        "strength": <integer 0-100>,
        "description": "<1-2 sentences on how this theme shows up for this competitor based on evidence>"
      }
    ]
  },
  "proof_gaps": [
    {
      "gap_type": "<a gap type specific to this brand — ONLY report things that are genuinely absent or weak in the evidence>",
      "description": "<specific explanation grounded in the evidence: what exactly is missing or weak, and what competitive risk does it create>",
      "severity": "<'critical' | 'high' | 'medium' | 'low'>",
      "narrative_affected": "<which brand narrative this gap weakens>"
    }
  ],
  "recommended_actions": [
    {
      "title": "<specific, actionable title tailored to this brand>",
      "action_type": "<'content' | 'pr' | 'page' | 'authority' | 'proof' | 'narrative'>",
      "priority": <integer 1-10>,
      "effort": "<'low' | 'medium' | 'high'>",
      "expected_impact": "<'low' | 'medium' | 'high'>",
      "why_it_matters": "<1-2 sentences: specific narrative and trust impact for THIS brand>",
      "what_to_do": "<2-3 concrete, specific steps tailored to this brand's situation>"
    }
  ]
}

Rules for scoring:
- DO NOT default to mid-range scores. A brand with strong actual evidence should score 75-90. A brand with weak evidence should score 25-45.
- narrative_score should reflect the actual clarity and consistency you observed across pages
- proof_density_score should be HIGH if you found real testimonials, stats, case studies — not low just because you want to recommend improvements
- risk_score is about ACTUAL risks visible in the evidence — weak claims, contradictions, competitor dominance on key themes

Rules for proof_gaps:
- ONLY include gaps for things genuinely absent or underweight in the evidence
- DO NOT say "no case studies" if case studies were found in the evidence
- DO NOT say "missing FAQ" if FAQ content was found
- DO NOT say "weak social proof" if reviews, testimonials or ratings were found
- Aim for 3-5 real gaps maximum, not a generic checklist

Rules for recommended_actions:
- Make them strategic and specific to THIS brand's situation
- Reference their actual competitive context
- Think like a senior PR advisor, not a generic content marketer
- Provide 5-8 actions sorted by priority descending

Be specific about ${project.brand_name}. Reference actual things you found. Make this genuinely useful.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI synthesis error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let scanJobId: string | null = null;

  try {
    const body = await req.json();
    const { project_id, scan_job_id } = body;

    if (!project_id || !scan_job_id) {
      return new Response(JSON.stringify({ error: "project_id and scan_job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    scanJobId = scan_job_id;

    const { data: project, error: projErr } = await supabase
      .from("pr_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projErr || !project) throw new Error("Project not found");

    // ── Step 1: Crawl brand pages ────────────────────────────────────────────
    await supabase
      .from("pr_scan_jobs")
      .update({ status: "running", started_at: new Date().toISOString(), progress_step: "Discovering and fetching brand pages…" })
      .eq("id", scan_job_id);

    console.log(`[pr-scan] Crawling brand: ${project.domain}`);
    const brandPages = await fetchDomainPages(project.domain, 12, 5);
    console.log(`[pr-scan] Brand pages fetched: ${brandPages.length}`);

    // ── Step 2: Crawl competitor pages ───────────────────────────────────────
    const competitors: { name: string; domain: string }[] = project.competitors || [];
    const competitorPages: Record<string, { url: string; text: string }[]> = {};

    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Fetching competitor pages…" })
      .eq("id", scan_job_id);

    // Fetch competitors in parallel
    await Promise.all(
      competitors.slice(0, 3).map(async (comp) => {
        console.log(`[pr-scan] Crawling competitor: ${comp.domain}`);
        const pages = await fetchDomainPages(comp.domain, 5, 5);
        if (pages.length > 0) competitorPages[comp.domain] = pages;
      })
    );

    const totalPages = brandPages.length + Object.values(competitorPages).flat().length;
    console.log(`[pr-scan] Total pages fetched: ${totalPages}`);

    // ── Step 3: Per-page extraction (parallel, gpt-4o-mini) ──────────────────
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Extracting evidence from each page…" })
      .eq("id", scan_job_id);

    const brandFacts = await Promise.all(brandPages.map(extractPageFacts));

    const competitorFacts: Record<string, string[]> = {};
    await Promise.all(
      Object.entries(competitorPages).map(async ([domain, pages]) => {
        competitorFacts[domain] = await Promise.all(pages.map(extractPageFacts));
      })
    );

    // ── Step 3.5: Load external mentions to enrich synthesis ─────────────────
    const { data: externalMentions } = await supabase
      .from("pr_external_mentions")
      .select("url, source_type, sentiment, sentiment_score, themes, proof_signals, key_quotes, ai_summary")
      .eq("project_id", project_id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(20);

    if (externalMentions && externalMentions.length > 0) {
      console.log(`[pr-scan] Including ${externalMentions.length} external mention(s) in synthesis`);
    }

    // ── Step 4: Strategic synthesis (gpt-4o) ─────────────────────────────────
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Running strategic narrative analysis…" })
      .eq("id", scan_job_id);

    const analysis = await synthesizeAnalysis(project, brandFacts, competitorFacts, externalMentions ?? []);

    // ── Step 5: Store results ─────────────────────────────────────────────────
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Storing results…" })
      .eq("id", scan_job_id);

    const { error: insertErr } = await supabase.from("pr_narrative_results").insert({
      project_id,
      scan_job_id,
      narrative_score: analysis.narrative_score ?? null,
      authority_score: analysis.authority_score ?? null,
      proof_density_score: analysis.proof_density_score ?? null,
      risk_score: analysis.risk_score ?? null,
      opportunity_score: analysis.opportunity_score ?? null,
      brand_narratives: analysis.brand_narratives ?? [],
      competitor_narratives: analysis.competitor_narratives ?? {},
      proof_gaps: analysis.proof_gaps ?? [],
      recommended_actions: analysis.recommended_actions ?? [],
      executive_summary: analysis.executive_summary ?? null,
      pages_analyzed: totalPages,
    });

    if (insertErr) throw new Error(`Failed to store results: ${insertErr.message}`);

    // ── Store score snapshot ──────────────────────────────────────────────────
    await supabase.from("pr_score_history").insert({
      project_id,
      scan_job_id,
      narrative_score: analysis.narrative_score ?? null,
      authority_score: analysis.authority_score ?? null,
      proof_density_score: analysis.proof_density_score ?? null,
      risk_score: analysis.risk_score ?? null,
      opportunity_score: analysis.opportunity_score ?? null,
      pages_analyzed: totalPages,
      snapshot_date: new Date().toISOString(),
    });

    // ── Update next_scan_at on project ────────────────────────────────────────
    const freq = project.scan_frequency || "weekly";
    const daysMap: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
    const days = daysMap[freq];
    if (days) {
      const nextScan = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await supabase.from("pr_projects")
        .update({ next_scan_at: nextScan.toISOString() })
        .eq("id", project_id);
    }

    // ── Fire alert evaluator (fire and forget) ────────────────────────────────
    fetch(`${SUPABASE_URL}/functions/v1/pr-alert-evaluator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ project_id, scan_job_id }),
    }).catch((e) => console.error("[pr-scan] alert evaluator fire failed:", e));

    await supabase
      .from("pr_scan_jobs")
      .update({ status: "completed", ended_at: new Date().toISOString(), progress_step: "Complete" })
      .eq("id", scan_job_id);

    return new Response(JSON.stringify({ success: true, pages_analyzed: totalPages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[pr-scan] error:", err);

    if (scanJobId) {
      await supabase
        .from("pr_scan_jobs")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
          error_message: err?.message || "Unknown error",
        })
        .eq("id", scanJobId);
    }

    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
