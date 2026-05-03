// supabase/functions/pr-fetch-mention/index.ts
//
// Fetches a candidate URL and decides whether it ACTUALLY mentions the brand
// before doing any AI analysis. The old version asked GPT-4o-mini to analyse
// every page, which produced "neutral, score 50" rows for pages that never
// named the brand at all — fabricated mentions cluttering the dashboard.
//
// New flow:
//   1. Fetch the URL (HTML → stripped text).
//   2. HARD GATE: does the text contain the brand name (word-boundary) or
//      the brand domain? If neither → status = 'not_a_mention', skip AI.
//   3. Run gpt-4o-mini with a tightened prompt that forbids inferring proof
//      signals or quotes that aren't literal text from the page.
//   4. POST-VALIDATE every key_quote: if the quote is not a substring of
//      the fetched text (case-insensitive, whitespace-loose), drop it.
//      This catches the model paraphrasing under the disguise of "quoting".

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
        "User-Agent": "Mozilla/5.0 (compatible; MarketersQuest/2.0; mention-fetcher)",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanHost(rawDomain: string | null | undefined): string {
  return (rawDomain || "")
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
}

/** Word-boundary case-insensitive search. Tolerates punctuation around the term. */
function containsBrandName(text: string, brandName: string): boolean {
  if (!brandName || !text) return false;
  const re = new RegExp(`\\b${escapeRegex(brandName)}\\b`, "i");
  return re.test(text);
}

/** Substring match — domain or root brand often appears unbounded. */
function containsBrandDomain(text: string, brandHost: string): boolean {
  if (!brandHost || !text) return false;
  return text.toLowerCase().includes(brandHost);
}

/** Loose-whitespace substring match for verifying quotes against source. */
function quoteAppearsInText(text: string, quote: string): boolean {
  if (!quote || !text) return false;
  // Normalise both sides: lowercase, collapse whitespace, strip surrounding quotes
  const norm = (s: string) =>
    s.toLowerCase().replace(/[""''`]/g, '"').replace(/\s+/g, " ").trim();
  const needle = norm(quote).replace(/^"+|"+$/g, "");
  if (needle.length < 8) return false; // too short to verify reliably
  return norm(text).includes(needle);
}

// ── AI mention analysis ──────────────────────────────────────────────────────

async function analyzeMention(
  text: string,
  url: string,
  brandName: string,
  brandDomain: string,
  competitors: { name: string; domain: string }[],
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

  const prompt = `You are a PR analyst reading an external webpage that has been confirmed to mention the brand "${brandName}". Your job is to extract ONLY signals that are literally present in the page text.

Brand being tracked: ${brandName} (${brandDomain})
Competitors to watch: ${competitorList || "none specified"}

URL: ${url}
Page content:
---
${text}
---

Return this JSON:

{
  "sentiment": "<how this page frames ${brandName}: 'positive' | 'neutral' | 'negative' | 'mixed'>",
  "sentiment_score": <integer 0-100; 0=very negative, 50=neutral, 100=very positive>,
  "themes": ["<up to 5 narrative themes ACTUALLY discussed about ${brandName} on this page — e.g. 'ease of use', 'pricing concerns'>"],
  "proof_signals": ["<concrete evidence the page CITES about ${brandName}: stats, awards, user counts, certifications, named case studies. Quote them as they appear.>"],
  "key_quotes": [
    { "quote": "<an EXACT verbatim quote from the page text above — copy/paste, do not paraphrase>", "context": "<who said it or which section it appeared in>" }
  ],
  "brand_mentions": [
    { "brand": "<brand name>", "framing": "<one sentence describing how the page frames them, grounded in actual text>" }
  ],
  "ai_summary": "<2-3 sentences: what THIS source says about ${brandName}'s narrative position. Reference specific phrasing from the page.>"
}

═══════════════════════════════════════════════════════════════════════
HARD RULES — VIOLATING ANY OF THESE = INVALID OUTPUT
═══════════════════════════════════════════════════════════════════════

1. Every key_quote MUST be a verbatim substring of the page content above. If you can't find a real quote, return an empty key_quotes array.
2. Every proof_signal MUST reference a stat/claim that LITERALLY appears in the page. Do not infer "they probably have customers". If no proof signal is in the text, return an empty array.
3. brand_mentions: include ONLY brands actually named in the text. Do not pad the list with competitors that aren't mentioned.
4. themes must reflect what the page DISCUSSES about ${brandName} — not generic industry themes.
5. If the page barely mentions ${brandName} (e.g. one passing reference), return short/empty arrays. Don't fabricate analysis to make the page seem important.
6. Return valid JSON only. No markdown fences, no commentary.`;

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

  if (!res.ok) throw new Error(`Marketers Quest error: ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  // Post-validate quotes: drop any that don't actually appear in the source text.
  const rawQuotes = Array.isArray(parsed.key_quotes) ? parsed.key_quotes : [];
  const verifiedQuotes = rawQuotes
    .filter((q: { quote: string; context: string }) => q && typeof q.quote === "string" && quoteAppearsInText(text, q.quote))
    .slice(0, 3);

  if (rawQuotes.length > 0 && verifiedQuotes.length < rawQuotes.length) {
    console.log(`[pr-fetch-mention] Dropped ${rawQuotes.length - verifiedQuotes.length}/${rawQuotes.length} quote(s) that did not appear in source`);
  }

  // Post-validate brand_mentions: drop entries whose brand string isn't on the page.
  const rawMentions = Array.isArray(parsed.brand_mentions) ? parsed.brand_mentions : [];
  const verifiedMentions = rawMentions.filter(
    (m: { brand: string; framing: string }) =>
      m && typeof m.brand === "string" && containsBrandName(text, m.brand),
  );

  return {
    sentiment: parsed.sentiment ?? "neutral",
    sentiment_score: typeof parsed.sentiment_score === "number" ? parsed.sentiment_score : 50,
    themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
    proof_signals: Array.isArray(parsed.proof_signals) ? parsed.proof_signals.slice(0, 8) : [],
    key_quotes: verifiedQuotes,
    brand_mentions: verifiedMentions,
    ai_summary: parsed.ai_summary ?? "",
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
    const brandName: string = project.brand_name || "";
    const brandHost = cleanHost(project.domain);

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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Step 3: Hard brand-presence gate ─────────────────────────────────────
    const titleAndBody = `${fetched.title || ""}\n${fetched.text}`;
    const brandInPage =
      containsBrandName(titleAndBody, brandName) ||
      (brandHost ? containsBrandDomain(titleAndBody, brandHost) : false);

    if (!brandInPage) {
      console.log(`[pr-fetch-mention] ${mention.url} does not mention ${brandName} — marking not_a_mention`);
      await supabase
        .from("pr_external_mentions")
        .update({
          status: "not_a_mention",
          page_title: fetched.title,
          fetched_text: fetched.text,
          error_message: `This page does not reference ${brandName} or ${brandHost || project.domain}. Skipped to avoid fabricating an analysis.`,
        })
        .eq("id", mentionId);

      return new Response(
        JSON.stringify({ success: true, status: "not_a_mention", mention_id: mentionId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Step 4: Store raw content + mark as analyzing ────────────────────────
    await supabase
      .from("pr_external_mentions")
      .update({
        status: "analyzing",
        page_title: fetched.title,
        fetched_text: fetched.text,
      })
      .eq("id", mentionId);

    // ── Step 5: AI analysis (page is confirmed to mention the brand) ─────────
    const analysis = await analyzeMention(
      fetched.text,
      mention.url,
      brandName,
      project.domain,
      project.competitors || [],
    );

    // ── Step 6: Store results ────────────────────────────────────────────────
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
