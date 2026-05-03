// supabase/functions/pr-visibility-check/index.ts
//
// AI Visibility check — for each tracked prompt, ask Marketers Quest sonar
// (live web search) the prompt and inspect the REAL citations sonar returns.
// Brand presence is computed deterministically:
//   - Cited:   the brand's domain appears in sonar's citations[] array
//   - Mentioned: the brand name (or domain) appears in sonar's answer text
//   - Absent:  neither
//
// We do not ask any LLM to judge whether a brand is present. That used to
// produce confidently-wrong answers because the model was scoring its own
// invention. Now the only "AI" piece is sonar's actual web search; the
// scoring is regex against the URLs sonar found.
//
// visibility_score is deterministic from citation rank + answer mention.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanHost(rawDomain: string | null | undefined): string {
  return (rawDomain || "")
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
}

function extractHost(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textContains(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  // For domains and short brand names use a word-boundary match
  const re = new RegExp(`\\b${escapeRegex(needle)}\\b`, "i");
  return re.test(haystack);
}

function findSentenceWith(text: string, needles: string[]): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const lc = needles.map((n) => (n || "").toLowerCase()).filter(Boolean);
  for (const s of sentences) {
    const ls = s.toLowerCase();
    if (lc.some((n) => ls.includes(n))) {
      return s.trim().slice(0, 280);
    }
  }
  return null;
}

function hostMatches(host: string, target: string): boolean {
  if (!host || !target) return false;
  return host === target || host.endsWith("." + target);
}

// ── Sonar call ────────────────────────────────────────────────────────────────

async function querySonar(
  promptText: string,
  geography: string,
): Promise<{ answer: string; citations: string[] }> {
  const systemMsg = `You are a knowledgeable research assistant with live web access. Answer the user's query in 150-250 words with a clear, factual response grounded in real sources you find via search. Cite real, currently-online sources. Do not fabricate brands, websites, statistics, or quotes. If reliable information is not available, say so plainly. Geography context for this query: ${geography || "Global"}.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: promptText },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Marketers Quest sonar error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const answer: string = data.choices?.[0]?.message?.content ?? "";
  const citations: string[] = Array.isArray(data.citations) ? data.citations : [];
  return { answer, citations };
}

// ── Single prompt visibility check ────────────────────────────────────────────

async function checkPromptVisibility(
  promptText: string,
  geography: string,
  brandName: string,
  brandDomain: string,
  competitors: { name: string; domain: string }[],
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
  const { answer, citations } = await querySonar(promptText, geography);

  // Deduplicate citation hosts in order of first appearance
  const seen = new Set<string>();
  const orderedHosts: string[] = [];
  for (const c of citations) {
    const host = extractHost(c);
    if (host && !seen.has(host)) {
      seen.add(host);
      orderedHosts.push(host);
    }
  }

  const brandHost = cleanHost(brandDomain);
  const brandInCitationIdx = brandHost
    ? orderedHosts.findIndex((h) => hostMatches(h, brandHost))
    : -1;
  const brandInCitations = brandInCitationIdx >= 0;
  const brandInAnswer =
    (brandName ? textContains(answer, brandName) : false) ||
    (brandHost ? answer.toLowerCase().includes(brandHost) : false);
  const brandPresent = brandInCitations || brandInAnswer;

  // Competitor presence — keyed by clean host
  const competitorPresence: Record<string, boolean> = {};
  for (const c of (competitors || []).slice(0, 5)) {
    const ch = cleanHost(c.domain);
    if (!ch) continue;
    const inCitations = orderedHosts.some((h) => hostMatches(h, ch));
    const inAnswer =
      (c.name ? textContains(answer, c.name) : false) ||
      answer.toLowerCase().includes(ch);
    competitorPresence[ch] = inCitations || inAnswer;
  }

  // Deterministic visibility_score
  let score = 0;
  if (brandInCitations) {
    if (brandInCitationIdx === 0) score = 90;
    else if (brandInCitationIdx <= 2) score = 75;
    else if (brandInCitationIdx <= 4) score = 60;
    else score = 50;
    // Small bump if also mentioned in the prose
    if (brandInAnswer) score = Math.min(100, score + 5);
  } else if (brandInAnswer) {
    score = 35;
  }

  const brandPosition = brandInCitations ? brandInCitationIdx + 1 : null;

  const brandContext = brandPresent
    ? findSentenceWith(answer, [brandName, brandHost].filter(Boolean) as string[])
    : null;

  const competitorsCitedCount = Object.values(competitorPresence).filter(Boolean).length;

  let whyAbsent: string | null = null;
  if (!brandPresent) {
    if (competitorsCitedCount > 0) {
      whyAbsent = `Live web search returned ${orderedHosts.length} source${orderedHosts.length !== 1 ? "s" : ""} for this query — none from ${brandDomain}. ${competitorsCitedCount} of your tracked competitor${competitorsCitedCount !== 1 ? "s are" : " is"} cited instead.`;
    } else if (orderedHosts.length === 0) {
      whyAbsent = `The live answer did not surface any cited sources we could match. The brand name ${brandName} does not appear in the answer text.`;
    } else {
      whyAbsent = `None of the ${orderedHosts.length} sources cited reference ${brandDomain}, and ${brandName} is not named in the answer text. Likely cause: insufficient indexed authority for this query's intent.`;
    }
  }

  let summary: string;
  if (brandInCitations && brandInCitationIdx === 0) {
    summary = `${brandName} is the top-cited source for this query.`;
  } else if (brandInCitations) {
    summary = `${brandName} is cited as source #${brandInCitationIdx + 1} of ${orderedHosts.length}.`;
  } else if (brandInAnswer) {
    summary = `${brandName} is mentioned in the answer text but no source from ${brandDomain} is cited.`;
  } else if (competitorsCitedCount > 0) {
    summary = `${brandName} is absent. ${competitorsCitedCount} tracked competitor${competitorsCitedCount !== 1 ? "s are" : " is"} cited instead.`;
  } else {
    summary = `${brandName} is absent from the live answer for this query.`;
  }

  return {
    brand_present: brandPresent,
    brand_position: brandPosition,
    brand_context: brandContext,
    competitor_presence: competitorPresence,
    cited_domains: orderedHosts.slice(0, 10),
    raw_answer: answer,
    why_absent: whyAbsent,
    analysis_summary: summary,
    visibility_score: score,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

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
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY must be configured");
    }

    const body = await req.json();
    const { project_id, run_id } = body;

    if (!project_id || !run_id) {
      return new Response(JSON.stringify({ error: "project_id and run_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    runId = run_id;

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

    await supabase
      .from("pr_visibility_runs")
      .update({ status: "running", total: trackedPrompts.length })
      .eq("id", run_id);

    let completed = 0;
    for (const prompt of trackedPrompts.slice(0, 10)) {
      try {
        const result = await checkPromptVisibility(
          prompt.prompt_text,
          prompt.geography || project.geography || "Global",
          project.brand_name,
          project.domain,
          competitors,
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
        await supabase.from("pr_visibility_results").insert({
          run_id,
          project_id,
          prompt_text: prompt.prompt_text,
          geography: prompt.geography || project.geography || "Global",
          brand_present: false,
          visibility_score: 0,
          analysis_summary: "Live AI search failed for this prompt.",
        });
      }

      completed++;
      await supabase
        .from("pr_visibility_runs")
        .update({ progress: completed })
        .eq("id", run_id);
    }

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
