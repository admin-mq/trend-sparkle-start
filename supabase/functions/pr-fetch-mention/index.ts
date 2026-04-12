import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Page fetching (same logic as pr-scan) ─────────────────────────────────────

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

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim().slice(0, 200) : null;
}

async function fetchUrl(url: string): Promise<{ text: string; title: string | null } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
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
    const text = stripHtml(html, 8000);
    const title = extractTitle(html);
    if (text.length < 80) return null;
    return { text, title };
  } catch {
    return null;
  }
}

// ── AI mention analysis ────────────────────────────────────────────────────────

async function analyzeMention(
  text: string,
  url: string,
  brandName: string,
  brandDomain: string,
  competitors: { name: string; domain: string }[]
): Promise<{
  sentiment: string;
  sentiment_score: number;
  themes: string[];
  proof_signals: string[];
  key_quotes: { quote: string; context: string }[];
  brand_mentions: { brand: string; framing: string }[];
  ai_summary: string;
}> {
  const competitorList = competitors
    .slice(0, 5)
    .map((c) => `${c.name} (${c.domain})`)
    .join(", ");

  const prompt = `You are a PR analyst reading an external webpage — it could be a press article, review, comparison roundup, blog post, or industry report.

Brand being tracked: ${brandName} (${brandDomain})
Competitors to watch: ${competitorList || "none specified"}

URL: ${url}
Content:
---
${text}
---

Analyse this page and return JSON:

{
  "sentiment": "<how this page frames ${brandName}: 'positive' | 'neutral' | 'negative' | 'mixed'>",
  "sentiment_score": <integer 0-100; 0=very negative, 50=neutral, 100=very positive>,
  "themes": ["<up to 5 narrative themes present, e.g. 'ease of use', 'pricing concerns', 'enterprise credibility'>"],
  "proof_signals": ["<concrete evidence cited: stats, awards, user counts, certifications, case studies referenced — quote them specifically>"],
  "key_quotes": [
    { "quote": "<exact impactful quote from the page>", "context": "<who said it or what section it appeared in>" }
  ],
  "brand_mentions": [
    { "brand": "<brand name>", "framing": "<how this source frames them — 1 sentence>" }
  ],
  "ai_summary": "<2-3 sentences: what this source tells us about ${brandName}'s narrative position and what it means for their authority or proof density>"
}

Rules:
- If ${brandName} is not mentioned at all, set sentiment = 'neutral', sentiment_score = 50, and note it in ai_summary.
- Only include proof_signals that are actually present in the text (no inference).
- key_quotes: up to 3 most impactful, must be actual text from the page.
- brand_mentions: include ${brandName} and any competitors mentioned. Skip brands not present.
- ai_summary must be specific to this source, not generic.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    sentiment: parsed.sentiment ?? "neutral",
    sentiment_score: typeof parsed.sentiment_score === "number" ? parsed.sentiment_score : 50,
    themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
    proof_signals: Array.isArray(parsed.proof_signals) ? parsed.proof_signals.slice(0, 8) : [],
    key_quotes: Array.isArray(parsed.key_quotes) ? parsed.key_quotes.slice(0, 3) : [],
    brand_mentions: Array.isArray(parsed.brand_mentions) ? parsed.brand_mentions : [],
    ai_summary: parsed.ai_summary ?? "",
  };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let mentionId: string | null = null;

  try {
    const body = await req.json();
    mentionId = body.mention_id;
    if (!mentionId) throw new Error("mention_id required");

    // Load mention + project
    const { data: mention, error: mErr } = await supabase
      .from("pr_external_mentions")
      .select("*, pr_projects!inner(brand_name, domain, competitors)")
      .eq("id", mentionId)
      .single();

    if (mErr || !mention) throw new Error("Mention not found");

    const project = mention.pr_projects;

    // ── Step 1: Mark as fetching ─────────────────────────────────────────────
    await supabase
      .from("pr_external_mentions")
      .update({ status: "fetching" })
      .eq("id", mentionId);

    // ── Step 2: Fetch the URL ────────────────────────────────────────────────
    const fetched = await fetchUrl(mention.url);

    if (!fetched) {
      await supabase
        .from("pr_external_mentions")
        .update({
          status: "failed",
          error_message: "Could not fetch this URL. It may be behind a paywall, require login, or be unavailable.",
        })
        .eq("id", mentionId);

      return new Response(
        JSON.stringify({ error: "Fetch failed", mention_id: mentionId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Store raw content + mark as analyzing ────────────────────────
    await supabase
      .from("pr_external_mentions")
      .update({
        status: "analyzing",
        page_title: fetched.title,
        fetched_text: fetched.text,
      })
      .eq("id", mentionId);

    // ── Step 4: AI analysis ──────────────────────────────────────────────────
    const analysis = await analyzeMention(
      fetched.text,
      mention.url,
      project.brand_name,
      project.domain,
      project.competitors || []
    );

    // ── Step 5: Store results ─────────────────────────────────────────────────
    await supabase
      .from("pr_external_mentions")
      .update({
        status: "done",
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        themes: analysis.themes,
        proof_signals: analysis.proof_signals,
        key_quotes: analysis.key_quotes,
        brand_mentions: analysis.brand_mentions,
        ai_summary: analysis.ai_summary,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", mentionId);

    return new Response(
      JSON.stringify({ success: true, mention_id: mentionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[pr-fetch-mention] error:", err);

    if (mentionId) {
      await supabase
        .from("pr_external_mentions")
        .update({ status: "failed", error_message: err?.message || "Unknown error" })
        .eq("id", mentionId)
        .catch(() => {});
    }

    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
