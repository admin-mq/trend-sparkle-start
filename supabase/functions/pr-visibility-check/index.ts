import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Single prompt visibility check ────────────────────────────────────────────

async function checkPromptVisibility(
  promptText: string,
  geography: string,
  brandName: string,
  brandDomain: string,
  competitors: { name: string; domain: string }[]
): Promise<{
  brand_present: boolean;
  brand_position: number | null;
  brand_context: string | null;
  competitor_presence: Record<string, boolean>;
  cited_domains: string[];
  raw_answer: string;
  why_absent: string | null;
  analysis_summary: string;
  visibility_score: number;
}> {
  const competitorList = competitors
    .slice(0, 5)
    .map((c) => `- ${c.name} (${c.domain})`)
    .join("\n");

  const system = `You are an AI answer engine and brand visibility analyst.

When given a search query, you will:
1. Answer it naturally, as a helpful AI assistant would — the kind of answer that would appear in ChatGPT, Perplexity, or Google's AI Overview
2. Analyze that answer for specific brand and competitor presence

Your natural answer should reflect what an AI system trained on public web data would actually say — mentioning real, well-known players in the space when relevant. Do not force mentions of unknown brands.

Always respond with a valid JSON object.`;

  const user = `Query: "${promptText}"
Geography context: ${geography || "Global"}

Brand to track: ${brandName} (domain: ${brandDomain})
Competitors to track:
${competitorList || "None specified"}

First, write a natural AI answer to this query (150-250 words), as if you're a helpful search AI. Mention specific companies, tools, or services that are genuinely well-known for this query.

Then analyze your own answer and return this JSON:

{
  "natural_answer": "<your 150-250 word AI answer to the query>",
  "brand_present": <true if ${brandName} or ${brandDomain} appears in the answer>,
  "brand_position": <null if absent; 1 if prominently featured first, 2-3 if mentioned midway, 4-5 if briefly mentioned at end>,
  "brand_context": "<if present: quote the exact sentence where the brand appears, else null>",
  "competitor_presence": {
    ${competitors.slice(0, 5).map((c) => `"${c.domain}": <true/false>`).join(",\n    ")}
  },
  "cited_domains": ["<list of website domains referenced or implied in the answer, e.g. 'hubspot.com', 'semrush.com'>"],
  "why_absent": "<if brand_present is false: 1-2 sentences on why the brand likely doesn't appear — e.g. low authority, missing category content, dominated by specific competitors>",
  "analysis_summary": "<1-2 sentences summarising the visibility situation for ${brandName} on this prompt>",
  "visibility_score": <integer 0-100: 0=completely absent, 50=mentioned but not prominently, 100=featured as a top recommendation>
}`;

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
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    brand_present: parsed.brand_present ?? false,
    brand_position: parsed.brand_position ?? null,
    brand_context: parsed.brand_context ?? null,
    competitor_presence: parsed.competitor_presence ?? {},
    cited_domains: Array.isArray(parsed.cited_domains) ? parsed.cited_domains : [],
    raw_answer: parsed.natural_answer ?? "",
    why_absent: parsed.why_absent ?? null,
    analysis_summary: parsed.analysis_summary ?? "",
    visibility_score: typeof parsed.visibility_score === "number" ? parsed.visibility_score : 0,
  };
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

  let runId: string | null = null;

  try {
    const body = await req.json();
    const { project_id, run_id } = body;

    if (!project_id || !run_id) {
      return new Response(JSON.stringify({ error: "project_id and run_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    runId = run_id;

    // Load project
    const { data: project, error: projErr } = await supabase
      .from("pr_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projErr || !project) throw new Error("Project not found");

    const trackedPrompts: { prompt_text: string; geography?: string }[] = project.tracked_prompts || [];
    const competitors: { name: string; domain: string }[] = project.competitors || [];

    if (trackedPrompts.length === 0) {
      await supabase
        .from("pr_visibility_runs")
        .update({ status: "failed", error: "No prompts to check", ended_at: new Date().toISOString() })
        .eq("id", run_id);
      return new Response(JSON.stringify({ error: "No tracked prompts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark run as running
    await supabase
      .from("pr_visibility_runs")
      .update({ status: "running", total: trackedPrompts.length })
      .eq("id", run_id);

    // Process each prompt sequentially (avoid rate limits)
    let completed = 0;
    for (const prompt of trackedPrompts.slice(0, 10)) {
      try {
        const result = await checkPromptVisibility(
          prompt.prompt_text,
          prompt.geography || project.geography || "Global",
          project.brand_name,
          project.domain,
          competitors
        );

        await supabase.from("pr_visibility_results").insert({
          run_id,
          project_id,
          prompt_text: prompt.prompt_text,
          geography: prompt.geography || project.geography || "Global",
          brand_present: result.brand_present,
          brand_position: result.brand_position,
          brand_context: result.brand_context,
          competitor_presence: result.competitor_presence,
          cited_domains: result.cited_domains,
          raw_answer: result.raw_answer,
          why_absent: result.why_absent,
          analysis_summary: result.analysis_summary,
          visibility_score: result.visibility_score,
        });
      } catch (promptErr) {
        console.error(`Error checking prompt "${prompt.prompt_text}":`, promptErr);
        // Store failed result so user sees something
        await supabase.from("pr_visibility_results").insert({
          run_id,
          project_id,
          prompt_text: prompt.prompt_text,
          geography: prompt.geography || project.geography || "Global",
          brand_present: false,
          visibility_score: 0,
          analysis_summary: "Analysis failed for this prompt.",
        });
      }

      completed++;
      await supabase
        .from("pr_visibility_runs")
        .update({ progress: completed })
        .eq("id", run_id);
    }

    // Mark complete
    await supabase
      .from("pr_visibility_runs")
      .update({ status: "completed", ended_at: new Date().toISOString(), progress: completed })
      .eq("id", run_id);

    return new Response(JSON.stringify({ success: true, prompts_checked: completed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("pr-visibility-check error:", err);

    if (runId) {
      await supabase
        .from("pr_visibility_runs")
        .update({ status: "failed", error: err?.message || "Unknown error", ended_at: new Date().toISOString() })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
