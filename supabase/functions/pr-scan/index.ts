import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Page fetching ─────────────────────────────────────────────────────────────

const COMMON_PATHS = ["/", "/about", "/services", "/product", "/products", "/faq", "/blog", "/why-us"];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

async function fetchPage(url: string): Promise<{ url: string; text: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "NarrativeOS/1.0 (narrative-intelligence-scanner)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    if (text.length < 100) return null;
    return { url, text };
  } catch {
    return null;
  }
}

async function fetchDomainPages(domain: string, maxPages = 4): Promise<{ url: string; text: string }[]> {
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  const urls = COMMON_PATHS.slice(0, maxPages).map((p) => base + p);
  const results = await Promise.all(urls.map(fetchPage));
  return results.filter(Boolean) as { url: string; text: string }[];
}

// ── OpenAI analysis ────────────────────────────────────────────────────────────

async function analyzeNarrative(project: any, brandPages: any[], competitorPages: Record<string, any[]>) {
  const brandContent = brandPages
    .map((p) => `[PAGE: ${p.url}]\n${p.text}`)
    .join("\n\n---\n\n");

  const competitorBlocks = Object.entries(competitorPages)
    .map(([domain, pages]) => {
      const content = pages.map((p: any) => `[PAGE: ${p.url}]\n${p.text}`).join("\n\n---\n\n");
      return `COMPETITOR: ${domain}\n${content}`;
    })
    .join("\n\n===\n\n");

  const system = `You are a senior PR and narrative intelligence analyst. You analyze brand websites and competitor sites to extract:
- The core narrative each brand is building
- Proof and trust signal density
- Authority signals
- Risk and weakness areas
- Competitive positioning

Always respond with a valid JSON object exactly matching the requested schema. Be specific and actionable. Write like a strategic advisor, not a generic consultant.`;

  const user = `Analyze the following brand and competitor content for ${project.brand_name} (${project.domain}).

Industry: ${project.industry || "Not specified"}
Geography: ${project.geography || "Global"}
Target Audience: ${project.target_audience || "Not specified"}

=== BRAND CONTENT ===
${brandContent || "No pages fetched."}

=== COMPETITOR CONTENT ===
${competitorBlocks || "No competitor pages fetched."}

Return a JSON object with this exact structure:
{
  "narrative_score": <integer 0-100, how strong and consistent the brand narrative is>,
  "authority_score": <integer 0-100, how credible and authoritative the brand appears>,
  "proof_density_score": <integer 0-100, how much concrete proof/evidence backs the claims>,
  "risk_score": <integer 0-100, how exposed the brand is to narrative risks — higher = more risky>,
  "opportunity_score": <integer 0-100, how much room for improvement and PR opportunity exists>,
  "executive_summary": "<3-4 sentences: what this brand's current narrative position is, key strengths, key risks, and top opportunity>",
  "brand_narratives": [
    {
      "theme": "<theme name, e.g. 'Innovation Leader', 'Trusted Partner'>",
      "strength": <integer 0-100>,
      "description": "<1-2 sentences on how this theme shows up>",
      "status": "<'strong' | 'emerging' | 'weak' | 'missing'>"
    }
  ],
  "competitor_narratives": {
    "<competitor_domain>": [
      {
        "theme": "<theme name>",
        "strength": <integer 0-100>,
        "description": "<how this theme shows up for this competitor>"
      }
    ]
  },
  "proof_gaps": [
    {
      "gap_type": "<e.g. 'No case studies', 'Weak social proof', 'No founder authority', 'Missing FAQ'>",
      "description": "<specific explanation of what is missing and why it matters>",
      "severity": "<'critical' | 'high' | 'medium' | 'low'>",
      "narrative_affected": "<which brand narrative this gap weakens>"
    }
  ],
  "recommended_actions": [
    {
      "title": "<specific, actionable title>",
      "action_type": "<'content' | 'pr' | 'page' | 'authority' | 'proof'>",
      "priority": <integer 1-10, higher = more urgent>,
      "effort": "<'low' | 'medium' | 'high'>",
      "expected_impact": "<'low' | 'medium' | 'high'>",
      "why_it_matters": "<1-2 sentences on the specific narrative/trust impact>",
      "what_to_do": "<2-3 concrete steps to take>"
    }
  ]
}

Provide 3-6 brand_narratives, up to 5 proof_gaps, and 5-8 recommended_actions sorted by priority descending. Be specific about ${project.brand_name}, not generic.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
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

    // Load project
    const { data: project, error: projErr } = await supabase
      .from("pr_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      throw new Error("Project not found");
    }

    // Mark job as running
    await supabase
      .from("pr_scan_jobs")
      .update({ status: "running", started_at: new Date().toISOString(), progress_step: "Fetching brand pages" })
      .eq("id", scan_job_id);

    // Fetch brand pages
    console.log(`Fetching brand pages for ${project.domain}`);
    const brandPages = await fetchDomainPages(project.domain, 5);
    console.log(`Fetched ${brandPages.length} brand pages`);

    // Fetch competitor pages
    const competitors: { name: string; domain: string }[] = project.competitors || [];
    const competitorPages: Record<string, { url: string; text: string }[]> = {};

    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Fetching competitor pages" })
      .eq("id", scan_job_id);

    for (const comp of competitors.slice(0, 3)) {
      console.log(`Fetching competitor pages for ${comp.domain}`);
      const pages = await fetchDomainPages(comp.domain, 3);
      if (pages.length > 0) {
        competitorPages[comp.domain] = pages;
      }
    }

    const totalPages = brandPages.length + Object.values(competitorPages).flat().length;
    console.log(`Total pages fetched: ${totalPages}`);

    // AI analysis
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Analyzing narratives with AI" })
      .eq("id", scan_job_id);

    const analysis = await analyzeNarrative(project, brandPages, competitorPages);

    // Store results
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Storing results" })
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

    // Mark job complete
    await supabase
      .from("pr_scan_jobs")
      .update({ status: "completed", ended_at: new Date().toISOString(), progress_step: "Complete" })
      .eq("id", scan_job_id);

    return new Response(JSON.stringify({ success: true, pages_analyzed: totalPages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("pr-scan error:", err);

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
