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
 * Tier-aware. Uses gpt-4o, evidence-grounded, with forbidden-phrase filter
 * and live brand-context + AI-search-visibility injection.
 */
async function synthesizeAnalysis(
  project: any,
  brandFacts: string[],
  competitorFacts: Record<string, string[]>,
  externalMentions: any[] = [],
  brandContext: any | null = null,
  visibilityResults: any[] = []
): Promise<{ analysis: any; evidence_url_pool_size: number }> {
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

  // ── Build the evidence URL pool ─────────────────────────────────────────────
  // Every claim returned by the LLM must cite from this pool — anything else is
  // hallucination and gets stripped in post-validation. URLs come from sources
  // that the synthesis ACTUALLY saw in its inputs:
  //   • brand pages we crawled (line-prefix `[url]` in brandFacts)
  //   • competitor pages we crawled
  //   • external mention URLs
  //   • sonar citations from the latest AI-search visibility run
  const urlFromFact = (s: string): string | null => {
    const m = s.match(/^\[(https?:\/\/[^\]]+)\]/);
    return m ? m[1] : null;
  };
  const evidenceUrls = new Set<string>();
  for (const f of brandFacts) { const u = urlFromFact(f); if (u) evidenceUrls.add(u); }
  for (const list of Object.values(competitorFacts)) {
    for (const f of list) { const u = urlFromFact(f); if (u) evidenceUrls.add(u); }
  }
  for (const m of externalMentions) {
    if (typeof m.url === "string" && m.url.startsWith("http")) evidenceUrls.add(m.url);
  }
  for (const v of visibilityResults) {
    const cited = Array.isArray(v.cited_domains) ? v.cited_domains : [];
    for (const c of cited) {
      if (typeof c === "string" && c.startsWith("http")) evidenceUrls.add(c);
    }
  }
  const evidenceList = Array.from(evidenceUrls);
  const evidenceBlock = evidenceList.length > 0
    ? `=== AVAILABLE EVIDENCE URLS (the ONLY URLs you may cite) ===
Every claim object you return MUST include a "sources" array of 0-3 URLs chosen
from this list. URLs not in this list will be silently dropped — do NOT invent.
If a claim is genuinely not backed by any of these URLs, return "sources": [].

${evidenceList.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
    : `=== AVAILABLE EVIDENCE URLS ===
(No evidence URLs available for this scan. Return "sources": [] for every claim.)`;
  console.log(`[pr-scan] evidence pool — ${evidenceList.length} URL(s) available for citation`);

  // ── Brand context block (live web intelligence) ──
  const tier = brandContext?.tier && brandContext.tier !== "unknown" ? brandContext.tier : "unknown";
  const tierLabel: Record<string, string> = {
    mega: "MEGA-BRAND (Fortune 500 / >$10B / >10K employees)",
    enterprise: "ENTERPRISE ($1B-$10B / 1K-10K employees)",
    growth: "GROWTH-STAGE ($10M-$1B / 50-1K employees)",
    startup: "STARTUP (<$10M / <50 employees)",
    unknown: "UNCLASSIFIED (treat as growth-stage by default)",
  };
  const effectiveTier = tier === "unknown" ? "growth" : tier;

  const brandContextBlock = brandContext ? `=== LIVE BRAND CONTEXT (web intelligence, last 90 days) ===
Tier: ${tierLabel[tier] ?? tier}${brandContext.tier_rationale ? ` — ${brandContext.tier_rationale}` : ""}
Scale: ${brandContext.approximate_revenue ?? "unknown"} revenue · ${brandContext.approximate_employees ?? "unknown"} employees · ${brandContext.public_or_private ?? "unknown"}${brandContext.ticker_symbol ? ` (${brandContext.ticker_symbol})` : ""}
Founded: ${brandContext.founded_year ?? "unknown"} | HQ: ${brandContext.headquarters ?? "unknown"}
Market position: ${brandContext.market_position ?? "unknown"}
Primary scale-competitors: ${(brandContext.primary_competitors ?? []).join(", ") || "unknown"}

Recent press themes (last 90 days):
${(brandContext.recent_press_themes ?? []).map((t: string) => `  • ${t}`).join("\n") || "  • (none surfaced)"}

Active PR risks the brand is currently exposed to or managing:
${(brandContext.active_pr_risks ?? []).map((t: string) => `  • ${t}`).join("\n") || "  • (none surfaced)"}

Open narrative whitespaces (no competitor strongly owns these yet):
${(brandContext.open_narrative_whitespaces ?? []).map((t: string) => `  • ${t}`).join("\n") || "  • (none surfaced)"}

AI search landscape: ${brandContext.ai_search_landscape_note ?? "(not assessed)"}` : `=== LIVE BRAND CONTEXT ===
(Not yet derived. Treat as growth-stage. Suggestions should NOT assume startup tier.)`;

  // ── AI search visibility block ──
  const visibilityBlock = visibilityResults.length > 0 ? (() => {
    const present = visibilityResults.filter((v) => v.brand_present).length;
    const total = visibilityResults.length;
    const lines = visibilityResults.map((v) => {
      const compDomination = v.competitor_presence
        ? Object.entries(v.competitor_presence as Record<string, boolean>)
            .filter(([_, p]) => p).map(([d]) => d).join(", ")
        : "";
      const cited = Array.isArray(v.cited_domains) && v.cited_domains.length > 0
        ? ` | cited: ${(v.cited_domains as string[]).slice(0, 3).join(", ")}${v.cited_domains.length > 3 ? "…" : ""}`
        : "";
      return `  • "${v.prompt_text}" — ${v.brand_present ? `BRAND PRESENT${v.brand_position ? ` (#${v.brand_position})` : ""}` : "BRAND ABSENT"}${compDomination ? ` | competitors present: ${compDomination}` : ""}${cited}`;
    }).join("\n");
    return `=== AI SEARCH VISIBILITY (latest run — most valuable signal) ===
Brand appears in ${present}/${total} tracked buying-intent queries.
${lines}

This is the new "page one of Google." A brand absent from AI-search responses for its own category is functionally invisible to the next generation of buyers, no matter how much they spend on traditional channels.`;
  })() : `=== AI SEARCH VISIBILITY ===
(No visibility run completed yet. After scan, run a visibility check to surface where the brand wins/loses in AI search.)`;

  const system = `You are a senior PR strategist advising the head of communications at the brand below. You think like a Fortune-500 comms head — narrative warfare, media relations, crisis pre-emption, exec thought leadership, AI search positioning. You do NOT think like a content marketer or website copywriter.

═══════════════════════════════════════════════════════════════════════════════
TIER PLAYBOOK — match the suggestion to the brand's actual scale
═══════════════════════════════════════════════════════════════════════════════
THIS BRAND IS: ${tierLabel[effectiveTier] ?? "growth-stage"}

• MEGA / ENTERPRISE (Walmart, Salesforce, Coca-Cola scale):
  → Exec op-eds in tier-1 press (WSJ, FT, NYT, Atlantic, HBR, Bloomberg, Axios, Economist)
  → Narrative warfare moves vs NAMED competitors
  → AI search SERP shaping for high-stakes category queries
  → ESG / policy positioning, regulatory narrative shaping
  → Crisis pre-emption / inoculation campaigns
  → Owned proprietary data drops (exclusives to tier-1 outlets)
  → Analyst relations (Forrester, Gartner) and exec analyst briefings
  → Investor narrative + earnings-day positioning (if public)
  → CEO / C-suite thought leadership cadences with named platforms
  ⚠️  NEVER suggest: "add testimonials", "build trust", "create case studies",
     "showcase social proof", "develop FAQ", "improve about page" —
     these brands have all of that at scale already.

• GROWTH-STAGE ($10M-$1B):
  → Trade press exclusives in vertical (TechCrunch, The Information, Stratechery, Axios Pro)
  → Vertical thought leadership with NAMED journalist beats
  → Analyst relations (G2 Grid, IDC, Forrester wave entries)
  → Scaled customer story campaigns with named anchor accounts
  → Founder/exec podcast tour with named-tier shows
  → Category-defining content (definitive guides, benchmarks, indices)

• STARTUP (<$10M):
  → Founder thought leadership cadence (LinkedIn, X, Substack)
  → Niche podcast tours
  → Hand-curated case studies with named customers
  → Product Hunt / Hacker News narrative plays
  → Micro-influencer partnerships in vertical
  → Definitional category-creation content

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES — every recommended_action MUST satisfy ALL of:
═══════════════════════════════════════════════════════════════════════════════
1. NAME a specific channel — publication, podcast, journalist beat, AI search
   query, exec platform, analyst firm, conference. "Press coverage" alone fails.
2. REFERENCE competitive context — either "vs. {named competitor}" or
   "open whitespace because {specific reason from live context}".
3. INCLUDE strategic "why now" — what makes this the right move at this
   moment, ideally tied to active PR risks or recent press themes.
4. PASS the "would the CMO show this to the CEO without embarrassment" test.
   Apply ruthlessly.
5. USE the LIVE BRAND CONTEXT — recent press themes, active PR risks, open
   whitespaces, AI search landscape are your PRIMARY raw material. Reference
   them by name in your reasoning. The website evidence is secondary.

═══════════════════════════════════════════════════════════════════════════════
FORBIDDEN PHRASES (auto-fail — if you find yourself using these, REWRITE):
═══════════════════════════════════════════════════════════════════════════════
"build credibility", "enhance trust", "leverage social proof",
"showcase customer testimonials", "develop content strategy",
"improve customer experience", "integrate testimonials",
"establish thought leadership" (without naming a venue),
"create case studies" (for non-startup tiers),
"showcase success stories" (for non-startup tiers),
"drive engagement", "boost visibility", "strengthen brand",
"communicate value", "highlight expertise", "showcase expertise",
"engage audiences", "amplify reach", "create compelling content",
"share customer stories" (without specific outlet),
"add testimonials" (for non-startup tiers).

═══════════════════════════════════════════════════════════════════════════════
PROOF GAPS — what they should look like at each tier:
═══════════════════════════════════════════════════════════════════════════════
✅ Mega/enterprise GOOD examples:
  • "Brand absent from AI search query 'best online grocery delivery' while
     Amazon dominates with 80% mention rate — directly threatens grocery
     pipeline as AI becomes default search."
  • "CEO has not published a tier-1 op-ed in 14 months while Andy Jassy
     publishes monthly on AI strategy — competitor is actively shaping the
     category narrative."
  • "No proprietary data drop in 12 months while category competitors run
     quarterly — losing the 'category authority' positioning."

❌ NEVER as a gap (any tier above startup):
  • "lacks customer testimonials" / "missing FAQ" / "no case studies"
  • "weak social proof" / "absence of third-party validation"
  • "limited success stories"
  These are CRO observations, not PR gaps. They will be rejected.

═══════════════════════════════════════════════════════════════════════════════
EVIDENCE GROUNDING & HONESTY:
═══════════════════════════════════════════════════════════════════════════════
- LIVE BRAND CONTEXT (press themes, PR risks, whitespaces, AI search) is the
  HIGHEST-VALUE input. Reference it by name.
- AI SEARCH VISIBILITY data shows where the brand is winning/losing — use it.
- WEBSITE EVIDENCE is what the brand currently says about itself (secondary).
- COMPETITOR EVIDENCE shows what rivals are claiming (comparative).
- EXTERNAL MENTIONS are third-party validation signals (high trust).
- NEVER fabricate. NEVER report something as missing if the evidence shows
  it's present (e.g. don't say "no testimonials" if mentions show reviews).
- Be brutally specific. Generic = failure.
- EVERY claim object (brand_narrative, competitor_narrative entry, proof_gap,
  recommended_action) must include a "sources" array. Pick 0-3 URLs from the
  AVAILABLE EVIDENCE URLS list that genuinely back the claim. URLs not in that
  list will be silently dropped — do NOT invent. An empty sources array is
  acceptable when no URL evidence applies; it's more honest than a fake one.`;

  const user = `Generate the narrative intelligence report for ${project.brand_name} (${project.domain}).

Industry: ${project.industry || "Not specified"}
Geography: ${project.geography || "Global"}
Target Audience: ${project.target_audience || "Not specified"}

${brandContextBlock}

${visibilityBlock}

=== EVIDENCE FROM ${project.brand_name.toUpperCase()} WEBSITE (${brandFacts.length} pages) ===
${brandEvidence || "No pages could be fetched."}

=== EVIDENCE FROM COMPETITOR WEBSITES ===
${competitorBlocks || "No competitor pages fetched."}
${mentionsBlock ? `\n=== EXTERNAL THIRD-PARTY MENTIONS (${externalMentions.length} sources) ===
Press articles, review sites, roundups, or third-party pages about this brand.
Third-party sources are high-trust signals — weight heavily for authority_score and proof_density_score.

${mentionsBlock}` : ""}

${evidenceBlock}

═══════════════════════════════════════════════════════════════════════════════
Return ONLY a JSON object with this exact structure:
═══════════════════════════════════════════════════════════════════════════════
{
  "narrative_score": <0-100: clarity & consistency of brand's core narrative across evidence>,
  "authority_score": <0-100: credibility from press, mentions, third-party signals — for mega-brands, weight live brand context heavily>,
  "proof_density_score": <0-100: real evidence backing claims — for mega-brands, public data, financial filings, and known scale count as proof>,
  "risk_score": <0-100: genuine narrative risk visible in evidence + active_pr_risks from brand context — higher = more risk>,
  "opportunity_score": <0-100: untapped narrative space, prioritized by open_narrative_whitespaces and AI search gaps>,
  "executive_summary": "<4-5 sentences. Reference: tier, recent press themes, the single most acute active PR risk, the single highest-leverage open whitespace, and AI search posture. Sound like an actual senior PR advisor briefing the CEO.>",
  "brand_narratives": [
    {
      "theme": "<specific theme grounded in evidence — e.g. 'Everyday Low Price Leadership', 'Omnichannel Convenience'. NOT generic.>",
      "strength": <0-100>,
      "description": "<1-2 sentences citing actual content found>",
      "status": "<'strong' | 'emerging' | 'weak' | 'missing'>",
      "sources": ["<0-3 URLs from the AVAILABLE EVIDENCE URLS list — pick the ones that BEST back this theme & description>"]
    }
  ],
  "competitor_narratives": {
    "<competitor_domain>": [
      { "theme": "<grounded theme>", "strength": <0-100>, "description": "<1-2 sentences from competitor evidence>", "sources": ["<0-3 URLs from AVAILABLE EVIDENCE URLS — preferably competitor-domain pages>"] }
    ]
  },
  "proof_gaps": [
    {
      "gap_type": "<tier-appropriate gap. For mega/enterprise: AI search absence, exec voice silence, narrative warfare gaps, data drop cadence gaps, analyst-relations gaps, missing crisis inoculation. NOT testimonials or FAQ.>",
      "description": "<specific gap grounded in EVIDENCE + LIVE CONTEXT. Reference named competitors and specific press themes/risks.>",
      "severity": "<'critical' | 'high' | 'medium' | 'low'>",
      "narrative_affected": "<which brand narrative or PR risk this gap connects to>",
      "sources": ["<0-3 URLs from AVAILABLE EVIDENCE URLS that DEMONSTRATE the gap (e.g. competitor page showing the move the brand isn't making, or an AI-search citation showing the brand is missing). Empty array if no concrete URL evidence — that's honest.>"]
    }
  ],
  "recommended_actions": [
    {
      "title": "<specific action. Must name a channel/venue/query/journalist beat. e.g. 'Run 90-day grocery-delivery data drop exclusive to Bloomberg'>",
      "action_type": "<'content' | 'pr' | 'page' | 'authority' | 'proof' | 'narrative'>",
      "priority": <1-10>,
      "effort": "<'low' | 'medium' | 'high'>",
      "expected_impact": "<'low' | 'medium' | 'high'>",
      "why_it_matters": "<1-2 sentences. MUST reference: (a) competitive context — vs. named competitor or open whitespace, (b) why now — tied to recent_press_themes / active_pr_risks / AI visibility gap. Tier-appropriate framing.>",
      "what_to_do": "<2-4 concrete steps with named channels, named outlets, named journalists/podcasts, specific timing. The level of detail a CMO would brief their team with.>",
      "sources": ["<0-3 URLs from AVAILABLE EVIDENCE URLS supporting the why_it_matters reasoning. Empty array if the action is purely strategic and not URL-anchored.>"]
    }
  ]
}

═══════════════════════════════════════════════════════════════════════════════
Final reminders before generating:
═══════════════════════════════════════════════════════════════════════════════
1. Generate 5-8 actions, sorted by priority descending.
2. Generate 3-5 proof_gaps — only ones that genuinely matter at THIS tier.
3. EVERY action must pass: named channel ✓, competitive context ✓, why now ✓,
   tier-appropriate ✓, no forbidden phrases ✓.
4. The CMO of ${project.brand_name} should READ THIS and think "yes, this is
   what I'd brief my comms team with this Monday."
5. If any action would embarrass the CMO, REWRITE before returning.

Be brutally specific about ${project.brand_name}. Reference real things. Make it usable.`;

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
    throw new Error(`Marketers Quest synthesis error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  // ── Post-validation: drop hallucinated source URLs ──────────────────────────
  // The LLM is instructed to cite only from evidenceUrls, but we still verify.
  // Anything not in the pool gets stripped silently. We keep up to 3 per claim.
  const filterSources = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    const cleaned: string[] = [];
    for (const u of raw) {
      if (typeof u !== "string") continue;
      if (!evidenceUrls.has(u)) continue;
      if (!cleaned.includes(u)) cleaned.push(u);
      if (cleaned.length >= 3) break;
    }
    return cleaned;
  };

  let totalCited = 0;
  let totalDropped = 0;
  const accountFor = (raw: unknown, kept: string[]) => {
    if (Array.isArray(raw)) {
      totalCited += kept.length;
      totalDropped += Math.max(0, raw.length - kept.length);
    }
  };

  if (Array.isArray(parsed.brand_narratives)) {
    parsed.brand_narratives = parsed.brand_narratives.map((n: any) => {
      const kept = filterSources(n?.sources);
      accountFor(n?.sources, kept);
      return { ...n, sources: kept };
    });
  }
  if (parsed.competitor_narratives && typeof parsed.competitor_narratives === "object") {
    for (const [domain, list] of Object.entries(parsed.competitor_narratives)) {
      if (!Array.isArray(list)) continue;
      parsed.competitor_narratives[domain] = (list as any[]).map((n: any) => {
        const kept = filterSources(n?.sources);
        accountFor(n?.sources, kept);
        return { ...n, sources: kept };
      });
    }
  }
  if (Array.isArray(parsed.proof_gaps)) {
    parsed.proof_gaps = parsed.proof_gaps.map((g: any) => {
      const kept = filterSources(g?.sources);
      accountFor(g?.sources, kept);
      return { ...g, sources: kept };
    });
  }
  if (Array.isArray(parsed.recommended_actions)) {
    parsed.recommended_actions = parsed.recommended_actions.map((a: any) => {
      const kept = filterSources(a?.sources);
      accountFor(a?.sources, kept);
      return { ...a, sources: kept };
    });
  }
  console.log(`[pr-scan] sources — kept:${totalCited} dropped:${totalDropped} pool:${evidenceUrls.size}`);

  return { analysis: parsed, evidence_url_pool_size: evidenceUrls.size };
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

    // ── Step 3.6: Ensure brand_context is fresh (auto-derive if missing) ─────
    let brandContext = project.brand_context ?? null;
    if (!brandContext) {
      console.log(`[pr-scan] No brand_context found — deriving via Marketers Quest sonar`);
      await supabase
        .from("pr_scan_jobs")
        .update({ progress_step: "Pulling live brand intelligence (web search)…" })
        .eq("id", scan_job_id);

      try {
        const deriveRes = await fetch(`${SUPABASE_URL}/functions/v1/derive-brand-context`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ project_id, merge: false }),
        });
        if (deriveRes.ok) {
          const deriveJson = await deriveRes.json();
          brandContext = deriveJson?.brand_context ?? null;
          console.log(`[pr-scan] Brand context derived. Tier: ${brandContext?.tier ?? "unknown"}`);
        } else {
          console.warn(`[pr-scan] derive-brand-context failed (${deriveRes.status}); continuing without context`);
        }
      } catch (e) {
        console.warn(`[pr-scan] derive-brand-context exception: ${(e as any)?.message}; continuing without context`);
      }
    } else {
      console.log(`[pr-scan] Using existing brand_context. Tier: ${brandContext?.tier ?? "unknown"}`);
    }

    // ── Step 3.7: Load latest AI search visibility for synthesis ─────────────
    const { data: latestVisRun } = await supabase
      .from("pr_visibility_runs")
      .select("id")
      .eq("project_id", project_id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let visibilityResults: any[] = [];
    if (latestVisRun?.id) {
      const { data: visRows } = await supabase
        .from("pr_visibility_results")
        .select("prompt_text, brand_present, brand_position, visibility_score, competitor_presence, cited_domains")
        .eq("run_id", latestVisRun.id)
        .order("visibility_score", { ascending: false });
      visibilityResults = visRows ?? [];
      if (visibilityResults.length > 0) {
        console.log(`[pr-scan] Including ${visibilityResults.length} AI-search visibility result(s) in synthesis`);
      }
    }

    // ── Step 4: Strategic synthesis (gpt-4o) ─────────────────────────────────
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Running strategic narrative analysis…" })
      .eq("id", scan_job_id);

    const { analysis, evidence_url_pool_size } = await synthesizeAnalysis(
      project,
      brandFacts,
      competitorFacts,
      externalMentions ?? [],
      brandContext,
      visibilityResults
    );

    // ── Step 4b: Compute evidence_signals for low-confidence detection ───────
    // The synthesis is only as good as the evidence behind it. We capture the
    // input shape at scan-time so the UI can warn users when a report was
    // generated from thin inputs (few pages crawled, no mentions, no
    // visibility run, no live brand context). Stored on the narrative result
    // so the warning is sticky to that scan, not recomputed from current state.
    const competitorPageCount = Object.values(competitorPages).flat().length;
    const mentionCount = (externalMentions ?? []).length;
    const visibilityCount = visibilityResults.length;
    const hasBrandContext = !!brandContext && (brandContext.tier ?? "unknown") !== "unknown";

    const warnings: string[] = [];
    if (brandPages.length < 5) warnings.push(`Only ${brandPages.length} brand page(s) crawled — site may be JS-heavy or blocking bots`);
    if (competitorPageCount === 0) warnings.push("No competitor pages analyzed — comparative claims are weaker");
    if (mentionCount === 0) warnings.push("No external press mentions — authority signals are limited");
    if (visibilityCount === 0) warnings.push("No AI search visibility data — run a visibility check for the strongest signal");
    if (!brandContext) warnings.push("No live brand context derived — strategic suggestions may be generic");
    else if (!hasBrandContext) warnings.push("Brand tier is unknown — synthesis defaulted to growth-stage playbook");

    const lowConfidence =
      brandPages.length < 3 ||
      evidence_url_pool_size < 3 ||
      !brandContext;

    const evidence_signals = {
      brand_pages_crawled: brandPages.length,
      competitor_pages_crawled: competitorPageCount,
      external_mentions: mentionCount,
      visibility_results: visibilityCount,
      evidence_url_pool_size,
      brand_context_present: !!brandContext,
      brand_context_tier: brandContext?.tier ?? null,
      warnings,
      low_confidence: lowConfidence,
    };
    console.log(`[pr-scan] evidence_signals — low_confidence:${lowConfidence} warnings:${warnings.length}`);

    // ── Step 5: Store results ─────────────────────────────────────────────────
    await supabase
      .from("pr_scan_jobs")
      .update({ progress_step: "Storing results…" })
      .eq("id", scan_job_id);

    const { data: insertedNarrative, error: insertErr } = await supabase
      .from("pr_narrative_results")
      .insert({
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
        evidence_signals,
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(`Failed to store results: ${insertErr.message}`);

    // ── Step 5b: Seed pr_actions queue ────────────────────────────────────────
    // Each recommended_action becomes a row in pr_actions with status='todo'.
    // Stale 'todo' actions from previous scans (not yet touched by the user)
    // are archived so the queue reflects the latest synthesis. Actions with
    // user-applied state (in_progress/done/dismissed) and any with notes are
    // preserved untouched. Dedup_key keeps repeat actions across scans stable
    // (so a user's notes on "Launch quarterly data drops" survive re-runs).
    try {
      // Archive stale 'todo' actions from this project that have no user notes
      // and weren't created in this scan. (Done before insert so re-runs of the
      // same scan_job_id don't archive their own newly-created rows.)
      await supabase
        .from("pr_actions")
        .update({ status: "archived" })
        .eq("project_id", project_id)
        .eq("status", "todo")
        .is("notes", null)
        .neq("scan_job_id", scan_job_id);

      const actions = (analysis.recommended_actions ?? []) as any[];
      if (actions.length > 0 && insertedNarrative?.id) {
        const enc = new TextEncoder();
        const rows = await Promise.all(
          actions.map(async (a, idx) => {
            const title = String(a.title || "").trim();
            // Dedup key: stable hash of project + lowercased title
            const hashInput = `${project_id}|${title.toLowerCase()}`;
            const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(hashInput));
            const dedupKey = Array.from(new Uint8Array(hashBuf))
              .slice(0, 16)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            return {
              project_id,
              scan_job_id,
              narrative_result_id: insertedNarrative.id,
              title: title || `Action ${idx + 1}`,
              action_type: a.action_type ?? null,
              effort: a.effort ?? null,
              priority: typeof a.priority === "number" ? a.priority : idx + 1,
              expected_impact: a.expected_impact ?? null,
              what_to_do: a.what_to_do ?? null,
              why_it_matters: a.why_it_matters ?? null,
              sources: Array.isArray(a.sources) ? a.sources : [],
              status: "todo" as const,
              dedup_key: dedupKey,
            };
          })
        );

        // Upsert by (project_id, dedup_key) — refreshes scan_job_id, narrative_result_id,
        // and any fields that may have changed in the new synthesis.
        const { error: actionsErr } = await supabase
          .from("pr_actions")
          .upsert(rows, { onConflict: "project_id,dedup_key", ignoreDuplicates: false });
        if (actionsErr) console.error("[pr-scan] pr_actions upsert failed:", actionsErr);
        else console.log(`[pr-scan] Seeded ${rows.length} actions to pr_actions queue`);
      }
    } catch (e) {
      // Non-fatal: scan still succeeds even if pr_actions seeding fails
      console.error("[pr-scan] pr_actions seeding failed (non-fatal):", e);
    }

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
