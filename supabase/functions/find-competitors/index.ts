// supabase/functions/find-competitors/index.ts
//
// Finds 5 real competitors for a brand. Steps:
//   1. If business_summary/niche not provided, crawl the brand's website
//      and derive them via GPT-4o-mini — so the competitor LLM sees what
//      the brand actually does, not just its name.
//   2. Call sonar (live web search) with hard rules: verify each domain
//      via search, return fewer-but-real over five-but-fake, never invent.
//   3. Post-validate every returned domain with a HEAD/GET request. Drop
//      any that 404 or don't resolve.
//
// Returns at most 5 confirmed competitors.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Lightweight crawler (mirrors analyze-brand-website) ──────────────────────

function stripHtml(html: string, maxChars = 4000): string {
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

async function fetchPage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketersQuest/1.0; competitor-finder)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    return text.length >= 80 ? text : null;
  } catch {
    return null;
  }
}

async function deriveBrandContext(
  brandName: string,
  brandUrl: string,
  openaiKey: string,
): Promise<{ business_summary: string; niche: string } | null> {
  const base = brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`;
  const cleanBase = base.replace(/\/$/, "");

  // Fetch homepage + about (best effort, in parallel)
  const [home, about, products] = await Promise.all([
    fetchPage(cleanBase + "/"),
    fetchPage(cleanBase + "/about"),
    fetchPage(cleanBase + "/products"),
  ]);

  const combined = [home, about, products].filter(Boolean).join("\n---\n").slice(0, 8000);
  if (combined.length < 100) return null;

  const prompt = `You are a brand analyst. Based on the website content below for "${brandName}", extract:

1. business_summary — exactly what this brand sells/does, in one specific sentence
2. niche — the specific sub-niche they occupy, in one short phrase (e.g. "premium handcrafted sunglasses for women", not "eyewear")

Be concrete. Use the actual product/service names from the page. If the site is unclear, say so honestly.

Website content:
---
${combined}
---

Return ONLY this JSON:
{ "business_summary": "...", "niche": "..." }`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    if (!parsed.business_summary) return null;
    return { business_summary: parsed.business_summary, niche: parsed.niche || "" };
  } catch {
    return null;
  }
}

// ── Domain validation ────────────────────────────────────────────────────────

async function domainResolves(domain: string, timeoutMs = 5000): Promise<boolean> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    // Some sites block HEAD; fall back to GET if HEAD non-2xx/3xx.
    let res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketersQuest/1.0)" },
    }).catch(() => null);
    if (!res || (!res.ok && res.status !== 405)) {
      res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketersQuest/1.0)" },
      }).catch(() => null);
    }
    clearTimeout(t);
    return !!res && res.ok;
  } catch {
    return false;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      brand_name,
      brand_url,
      industry,
      geography,
      country,
      business_summary: providedSummary,
      niche: providedNiche,
    } = await req.json();

    if (!brand_name) {
      return new Response(
        JSON.stringify({ error: 'brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_API_KEY_TRENDQUEST') || '';
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ error: 'PERPLEXITY_API_KEY must be configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 1: derive real business context if not provided ────────────────
    let businessSummary = (providedSummary || "").trim();
    let niche = (providedNiche || "").trim();

    if ((!businessSummary || !niche) && brand_url && openaiKey) {
      console.log(`[find-competitors] Crawling ${brand_url} to derive context for "${brand_name}"`);
      const derived = await deriveBrandContext(brand_name, brand_url, openaiKey);
      if (derived) {
        businessSummary = businessSummary || derived.business_summary;
        niche = niche || derived.niche;
        console.log(`[find-competitors] Derived: ${businessSummary} / ${niche}`);
      } else {
        console.log(`[find-competitors] Could not derive context — proceeding with name only`);
      }
    }

    const location = geography || country || 'Unknown location';
    const countryLabel = country || geography || 'their country';
    const industryLabel = industry || 'their industry';

    // ── Step 2: build a grounded, anti-hallucination prompt ─────────────────
    const contextBlock = businessSummary
      ? `What this brand actually does:
"${businessSummary}"${niche ? `\n\nSpecific niche: ${niche}` : ""}`
      : `(Brand context unavailable — only the name and URL are known. Be EXTRA cautious: if you cannot confidently identify what this brand does from public information, return an empty competitors array rather than guess.)`;

    const prompt = `You are a competitive intelligence analyst with live web access. Find REAL, currently-operating competitors for the brand below.

Brand: ${brand_name}
Website: ${brand_url || 'unknown'}
Industry hint: ${industryLabel}
City/Region: ${location}
Country: ${countryLabel}

${contextBlock}

Return up to 5 competitors with this breakdown (skip a slot if you can't confirm a match):
- 2 LOCAL competitors based in ${location} or the same region
- 1 NATIONAL competitor at the ${countryLabel} level
- 2 GLOBAL/ASPIRATIONAL competitors — world-class brands ${brand_name} aspires to compete with

═══════════════════════════════════════════════════════════════════════
HARD RULES — VIOLATING ANY OF THESE = INVALID OUTPUT
═══════════════════════════════════════════════════════════════════════

1. EVERY competitor must sell something directly comparable to what THIS brand actually does (per the context above). Not "same industry" — same SHELF. If the brand sells handcrafted sunglasses, do NOT list a candy company because both are "consumer goods".

2. EVERY domain MUST be verified via web search. Search for the competitor's name + "official site" or "${brand_name} competitors" and use the result. Do not guess domain spelling.

3. NEVER invent or extrapolate domains. If you can find the brand but can't confirm its current official domain, OMIT that competitor.

4. Common trap: corporate parent vs. consumer brand. "Mars Wrigley" is a division of Mars Inc., the consumer site is mars.com — there is no marswrigley.com. Always confirm.

5. NEVER include ${brand_name} itself.

6. FEWER-BUT-REAL beats FIVE-BUT-FAKE. Returning 2 confirmed competitors is BETTER than 5 if 3 are guesses.

7. why_relevant must reference a SPECIFIC product/positioning overlap with what THIS brand does — not generic phrases like "operates in same space".

═══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT — return ONLY this JSON, no markdown, no explanation
═══════════════════════════════════════════════════════════════════════

{
  "competitors": [
    {
      "name": "Brand Name",
      "domain": "example.com",
      "type": "local" | "national" | "global",
      "why_relevant": "One specific sentence naming the actual product/positioning overlap.",
      "confirmed_via": "URL where you confirmed the domain (a live search result page or the brand's own site)",
      "is_aspirational": false
    }
  ]
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive intelligence analyst with live web search. You always verify domains by searching, never invent. You prefer returning fewer confirmed results over five guesses. Always respond with valid JSON only — no markdown fences, no commentary.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Marketers Quest API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // Strip markdown fences if model added them despite instructions
    const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Marketers Quest returned non-JSON');
      parsed = JSON.parse(match[0]);
    }

    const rawCompetitors: any[] = (parsed.competitors ?? []).slice(0, 5);
    const userBrandHost = (brand_url || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();

    // ── Step 3: post-validate every domain in parallel ──────────────────────
    const validated = await Promise.all(
      rawCompetitors.map(async (c) => {
        const domain = (c.domain || '').toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
        if (!domain) return null;
        if (userBrandHost && domain === userBrandHost) return null; // never include self
        const ok = await domainResolves(domain);
        if (!ok) {
          console.log(`[find-competitors] Dropping ${c.name} — domain ${domain} did not resolve`);
          return null;
        }
        return {
          name: c.name,
          domain,
          type: c.type,
          why_relevant: c.why_relevant,
          confirmed_via: c.confirmed_via,
          is_aspirational: !!c.is_aspirational,
        };
      })
    );

    const competitors = validated.filter((c): c is NonNullable<typeof c> => c !== null);

    console.log(`[find-competitors] Returned ${competitors.length}/${rawCompetitors.length} validated competitors`);

    return new Response(
      JSON.stringify({
        competitors,
        derived_context: businessSummary ? { business_summary: businessSummary, niche } : null,
        rejected_count: rawCompetitors.length - competitors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in find-competitors:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', competitors: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
