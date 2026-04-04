import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Crawler (adapted from pr-scan) ────────────────────────────────────────────

function stripHtml(html: string, maxChars = 6000): string {
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

function discoverInternalLinks(html: string, base: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"'#?]+)["']/gi)].map((m) => m[1]).filter(Boolean);
  const internal: string[] = [];

  for (const href of hrefs) {
    try {
      let path: string;
      if (href.startsWith("http")) {
        const u = new URL(href);
        const b = new URL(base);
        if (u.hostname !== b.hostname) continue;
        path = u.pathname;
      } else if (href.startsWith("/")) {
        path = href;
      } else {
        continue;
      }
      if (path === "/" || path.length < 2) continue;
      internal.push(path);
    } catch { /* skip */ }
  }

  const scoreMap: Record<string, number> = {};
  const highKw = ["about", "mission", "values", "story", "team", "product", "service", "solution", "feature"];
  const medKw = ["blog", "pricing", "faq", "why", "how", "customer", "industry"];

  for (const path of internal) {
    const p = path.toLowerCase();
    let score = 1;
    if (highKw.some((k) => p.includes(k))) score = 10;
    else if (medKw.some((k) => p.includes(k))) score = 5;
    scoreMap[path] = score;
  }

  return [...new Set(Object.keys(scoreMap))].sort((a, b) => (scoreMap[b] ?? 0) - (scoreMap[a] ?? 0)).slice(0, 15);
}

async function fetchPage(url: string): Promise<{ url: string; text: string; html?: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TrendQuest/1.0; brand-analysis-bot)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    if (text.length < 80) return null;
    return { url, text, html };
  } catch {
    return null;
  }
}

async function crawlWebsite(websiteUrl: string, maxPages = 5): Promise<{ url: string; text: string }[]> {
  const base = websiteUrl.replace(/\/$/, "");
  const homepage = await fetchPage(base + "/");
  const results: { url: string; text: string }[] = [];

  if (!homepage) {
    // Try without trailing slash
    const alt = await fetchPage(base);
    if (alt) results.push({ url: alt.url, text: alt.text });
    return results;
  }

  results.push({ url: homepage.url, text: homepage.text });

  const discovered = discoverInternalLinks(homepage.html || "", base);
  const fallbacks = ["/about", "/about-us", "/our-story", "/products", "/services", "/solutions"];
  const allPaths = [...new Set([...discovered, ...fallbacks])].slice(0, (maxPages - 1) * 2);

  const batchSize = 4;
  for (let i = 0; i < allPaths.length && results.length < maxPages; i += batchSize) {
    const batch = allPaths.slice(i, i + batchSize);
    const fetched = await Promise.all(batch.map((p) => fetchPage(base + p)));
    for (const f of fetched) {
      if (f && results.length < maxPages) results.push({ url: f.url, text: f.text });
    }
  }

  return results;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_API_KEY_TRENDQUEST');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const { website_url } = await req.json();
    if (!website_url || typeof website_url !== 'string') {
      throw new Error('website_url is required');
    }

    // Normalise URL
    let url = website_url.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    console.log(`[analyze-brand-website] Crawling: ${url}`);
    const pages = await crawlWebsite(url, 5);
    console.log(`[analyze-brand-website] Fetched ${pages.length} pages`);

    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: 'Could not fetch website. Please check the URL.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Combine page content
    const content = pages
      .map((p) => `[Page: ${p.url}]\n${p.text}`)
      .join('\n\n---\n\n')
      .slice(0, 20000);

    // GPT extraction
    const prompt = `You are a brand analyst. Based on the website content below, extract brand profile information.

Website content:
---
${content}
---

Return ONLY valid JSON with these exact fields:
{
  "brand_name": "Short brand/company name",
  "business_summary": "1-2 sentence description of what this business does and its value proposition",
  "industry": "Pick the CLOSEST match from: Retail & E-commerce | FMCG / Consumer Goods | Technology & Software (SaaS/AI) | Media, Entertainment & Gaming | Healthcare & Pharmaceuticals | Finance & Insurance | Hospitality & Tourism | Food Services (restaurants/cloud kitchens) | Professional Services (consulting/legal/HR) | Education & Training (edtech/upskilling) | Other",
  "niche": "Specific sub-niche or specialisation in 1 line (e.g. 'B2B SaaS for HR teams' or 'organic skincare for sensitive skin')",
  "audience": "Pick the CLOSEST match from: Gen Z | Millennials | Gen Z & Millennials | Parents | Professionals | Students | Everyone | Custom",
  "geography": "Pick the CLOSEST match from: Global | US & Canada | UK & Europe | India | Middle East | Southeast Asia | Latin America | Custom",
  "tones": ["Pick 1-3 tones that best match from: Casual | Professional | Educational | High-energy | Minimal & clean | Bold / edgy | Playful | Sarcastic | Wholesome | Luxury / premium | Naughty | Savage"]
}

Rules:
- brand_name: just the company name, no tagline
- If geography is unclear, use "Global"
- tones must be exact strings from the list above
- Return ONLY the JSON, no explanation`;

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!gptRes.ok) throw new Error(`GPT call failed: ${gptRes.status}`);
    const gptData = await gptRes.json();
    const extracted = JSON.parse(gptData.choices[0].message.content);

    console.log(`[analyze-brand-website] Extracted:`, JSON.stringify(extracted));

    return new Response(JSON.stringify({ success: true, brand_profile: extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[analyze-brand-website] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
