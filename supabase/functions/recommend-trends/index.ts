import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase credentials.
// Prefer explicit EXTERNAL_SUPABASE_* env vars (for cross-project setups
// where the trends DB lives in a different project from the edge functions).
// Otherwise fall back to the auto-injected SUPABASE_URL / SUPABASE_ANON_KEY
// that every Supabase Edge Function gets for free (same-project lookups).
// Never hardcode keys in source — they leak via git, Lovable previews, and
// the deployed function bundle. Anyone with read access to this repo would
// have full anon-key access to the trends DB.
const EXTERNAL_SUPABASE_URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const EXTERNAL_SUPABASE_ANON_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.error("[recommend-trends] Missing Supabase credentials. Set EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_ANON_KEY or rely on auto-injected SUPABASE_URL/SUPABASE_ANON_KEY.");
}

// Tier 3 / Fix #1 — Observation history for sparklines.
//
// Fetches up to 14 days of time-series observations for the specified
// trend_ids in a single round-trip, then groups them by trend_id and
// caps each list at the 14 most recent. The UI uses this to render an
// inline sparkline; insufficient history (<2 points) renders nothing.
//
// Honesty rule: we ORDER BY observed_at ASC so the consumer reads
// chronologically. The UI must NOT extrapolate beyond the latest
// observation — what we have is what we show.
type Observation = {
  observed_at: string;
  virality_score: number | null;
  corroboration_score: number | null;
  timing: string | null;
  ig_validated: string | null;
  yt_view_count: number | null;
  yt_like_count: number | null;
  yt_comment_count: number | null;
};

async function fetchObservationHistory(
  supabase: any,
  trendIds: string[],
  daysBack = 14,
): Promise<Map<string, Observation[]>> {
  const map = new Map<string, Observation[]>();
  if (trendIds.length === 0) return map;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const { data, error } = await supabase
    .from('trend_observations')
    .select('trend_id, observed_at, virality_score, corroboration_score, timing, ig_validated, yt_view_count, yt_like_count, yt_comment_count')
    .in('trend_id', trendIds)
    .gte('observed_at', cutoff.toISOString())
    .order('observed_at', { ascending: true })
    .limit(500);
  if (error) {
    // Don't break recommendations on a sparkline-data fetch failure —
    // surface the error and return an empty map so the UI just hides
    // sparklines for this response. This is degraded, not broken.
    console.warn('[recommend-trends] Observation history fetch error:', error);
    return map;
  }
  for (const row of (data || [])) {
    const obs: Observation = {
      observed_at:         row.observed_at,
      virality_score:      row.virality_score,
      corroboration_score: row.corroboration_score,
      timing:              row.timing,
      ig_validated:        row.ig_validated,
      yt_view_count:       row.yt_view_count,
      yt_like_count:       row.yt_like_count,
      yt_comment_count:    row.yt_comment_count,
    };
    const list = map.get(row.trend_id) || [];
    list.push(obs);
    map.set(row.trend_id, list);
  }
  // Cap each trend's history at the 14 most recent observations. Already
  // sorted ASC by observed_at, so slice from the end.
  for (const [k, list] of map) {
    if (list.length > 14) map.set(k, list.slice(-14));
  }
  return map;
}

// Tier 3 / Fix #2 — Competitor coverage signal.
//
// Goal: tell users whether their TRACKED competitors have already posted
// about a trend, vs nobody in their watchlist has touched it yet (a true
// "first-mover window"). The only ground-truth signal we have today is
// YouTube — fetch-trends captures `yt_top_publishers` (up to 5 distinct
// channels with recent videos on the trend) per trend row. We intersect
// those publishers against the user's `profile.competitors` array.
//
// Honesty rules (mirrors the contract in the migration comment):
//   • yt_top_publishers === null → "couldn't check". UI must render this
//     as ambiguous, never as a positive first-mover claim.
//   • yt_top_publishers === [] (empty)  → real "no one on YouTube" signal.
//     Surface as "first-mover on YouTube — your tracked competitors
//     haven't posted yet". The "on YouTube" qualifier is mandatory.
//   • yt_top_publishers has items, none match → first-mover signal still
//     valid: a non-competitor channel posted, but none of *your tracked*
//     competitors have. Same first-mover copy.
//   • yt_top_publishers has items, some match → "X covered" badge with
//     the matched competitor names + links to their videos.
//
// We do NOT claim coverage on platforms we can't check (IG, TikTok,
// LinkedIn). The badge copy is platform-explicit so the user knows to
// verify elsewhere themselves.
type Competitor = {
  name: string;
  domain?: string;
  type?: string;
  why_relevant?: string;
  is_aspirational?: boolean;
};

type YouTubePublisher = {
  channel_id: string;
  channel_title: string;
  video_id: string;
  video_title: string;
  published_at: string;
};

type CompetitorMatch = {
  competitor_name: string;
  publisher: YouTubePublisher;
};

type CompetitorCoverage = {
  /** Which platform's data backed this verdict. Always 'YouTube' today. */
  checked_platform: 'YouTube';
  /**
   * What we found. NULL = couldn't check (no API key, search error).
   * UI MUST render NULL as ambiguous — never as first-mover.
   */
  publishers: YouTubePublisher[] | null;
  /** Tracked competitors that we matched in `publishers`. May be empty. */
  matches: CompetitorMatch[];
  /**
   * Tracked competitors that we LOOKED FOR but didn't find on this trend's
   * publisher list. We surface this in the badge tooltip so the user can
   * see exactly which competitors we checked — transparency over magic.
   */
  unmatched_competitors: string[];
};

/**
 * Normalize a string for fuzzy comparison: lowercase, strip non-alpha,
 * collapse whitespace. We compare normalized competitor names against
 * normalized channel titles using substring containment in BOTH directions
 * — "Nike" matches a channel called "Nike Football" and a competitor
 * called "Nike Football" matches a channel "Nike". We intentionally do
 * NOT do token-level matching (e.g. "Sports" alone shouldn't match every
 * sports brand) — substring is conservative and avoids false positives.
 */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Domains often look like "nike.com" or "www.shopify.co.uk". Strip
 * subdomain + TLD to get a comparable brand token.
 */
function domainBrandToken(domain: string | undefined): string | null {
  if (!domain) return null;
  const cleaned = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const firstLabel = cleaned.split('/')[0].split('.')[0];
  return firstLabel.length >= 3 ? normalizeName(firstLabel) : null;
}

function computeCompetitorCoverage(
  publishers: YouTubePublisher[] | null,
  competitors: Competitor[],
): CompetitorCoverage {
  // No competitors configured → no badge to render. Return an empty
  // shell so the UI's null check still works without special-casing.
  if (!Array.isArray(competitors) || competitors.length === 0) {
    return { checked_platform: 'YouTube', publishers, matches: [], unmatched_competitors: [] };
  }

  if (publishers === null) {
    // We genuinely couldn't check — preserve the null and report no
    // matches. UI MUST treat publishers===null as ambiguous.
    return {
      checked_platform: 'YouTube',
      publishers: null,
      matches: [],
      unmatched_competitors: competitors.map(c => c.name),
    };
  }

  const matches: CompetitorMatch[] = [];
  const unmatched: string[] = [];
  for (const competitor of competitors) {
    const nameTokens: string[] = [];
    const normName = normalizeName(competitor.name || '');
    if (normName.length >= 3) nameTokens.push(normName);
    const domainToken = domainBrandToken(competitor.domain);
    if (domainToken && !nameTokens.includes(domainToken)) nameTokens.push(domainToken);
    if (nameTokens.length === 0) {
      unmatched.push(competitor.name);
      continue;
    }

    let matched: YouTubePublisher | null = null;
    for (const pub of publishers) {
      const normChannel = normalizeName(pub.channel_title || '');
      if (!normChannel) continue;
      // Substring containment in either direction. Conservative — see
      // the normalizeName() docstring for why we don't do token splits.
      if (nameTokens.some(t => normChannel.includes(t) || t.includes(normChannel))) {
        matched = pub;
        break;
      }
    }
    if (matched) {
      matches.push({ competitor_name: competitor.name, publisher: matched });
    } else {
      unmatched.push(competitor.name);
    }
  }

  return {
    checked_platform: 'YouTube',
    publishers,
    matches,
    unmatched_competitors: unmatched,
  };
}

// Tier 3 / Fix #5 — YouTube velocity signal.
//
// Without Reddit (currently policy-gated), we lose the "discussion intensity"
// signal — proof that people are actively talking about a trend RIGHT NOW.
// The substitute we already have but never surfaced: views accumulated on
// the best-matching recent YouTube video, divided by hours since that
// video was uploaded. A 100K-view video published 6h ago is a categorically
// different signal than a 100K-view video from 10 days ago — fetch-trends
// captures both numbers, recommend-trends now puts them in conversation.
//
// Honesty rules:
//   • Suppress entirely when yt_view_count OR yt_video_published_at is null.
//     "couldn't check" is not "the trend has zero reach."
//   • Suppress when hours_since_publish < 3. Three hours of view data is too
//     thin to claim a stable rate; a freshly posted video might pull 50K
//     views in its first hour and stall — we'd badge it "racing" and be
//     wrong an hour later. Honest abstention beats fast-and-wrong.
//   • Tier thresholds are tuned against typical YouTube performance bands
//     (see THRESHOLDS comment). The TIER is a UI hint; the LITERAL numbers
//     (views + hours_since_publish) are the contract — the badge tooltip
//     shows "X views in Yh since upload" past-tense, descriptive, no
//     forward extrapolation. We never tell the user "this trend will hit
//     N views by tomorrow" — that's a forecast we can't honestly make.
type YouTubeVelocityTier = 'racing' | 'strong' | 'steady' | 'slow';

type YouTubeVelocity = {
  tier: YouTubeVelocityTier;
  views: number;
  hours_since_publish: number;
  views_per_hour: number;
};

/**
 * Compute the velocity signal for a trend's matched YouTube video.
 * Returns NULL when:
 *   - either input is missing (we can't compute a rate),
 *   - the published_at timestamp parses to NaN,
 *   - hours_since_publish < 3 (sample too thin — see honesty rules).
 *
 * THRESHOLDS — calibrated against YouTube's typical bands for trending
 * content. Examples:
 *   - racing  ≥ 20K views/hr → big music drops, viral news (rare).
 *   - strong  ≥  5K views/hr → solid trending creator/news content.
 *   - steady  ≥  1K views/hr → real audience interest, not background noise.
 *   - slow    <  1K views/hr → still real data, but signal is muted —
 *                              show the badge so users see the honest read.
 */
function computeYouTubeVelocity(
  viewCount: number | null | undefined,
  publishedAt: string | null | undefined,
  now: Date = new Date(),
): YouTubeVelocity | null {
  if (viewCount == null || !publishedAt) return null;
  const published = new Date(publishedAt);
  const publishedMs = published.getTime();
  if (Number.isNaN(publishedMs)) return null;
  if (viewCount < 0) return null;

  const hoursSincePublish = (now.getTime() - publishedMs) / 3_600_000;
  if (hoursSincePublish < 3) return null;

  const viewsPerHour = viewCount / hoursSincePublish;
  let tier: YouTubeVelocityTier;
  if (viewsPerHour >= 20_000)     tier = 'racing';
  else if (viewsPerHour >=  5_000) tier = 'strong';
  else if (viewsPerHour >=  1_000) tier = 'steady';
  else                              tier = 'slow';

  return {
    tier,
    views: viewCount,
    // Round to 1 decimal so the tooltip reads "in 6.4h" not "6.371h".
    hours_since_publish: Math.round(hoursSincePublish * 10) / 10,
    // Whole-number views/hour for the tooltip — no decimals on view counts.
    views_per_hour: Math.round(viewsPerHour),
  };
}

// Tier 3 / Fix #6 — Trend decay forecast.
//
// Now that `trend_observations` is accumulating real time-series data,
// we can do something we couldn't before: project when a declining
// trend will cross a "no longer worth posting" threshold. This is the
// first forecast signal in the system — every prior signal was a
// snapshot or a past observation.
//
// Method: simple linear regression of virality_score vs. observed_at
// (treated as days from the earliest observation). Picked because:
//   - it's transparent — users can verify the math from the tooltip,
//   - it doesn't pretend to capture nuance we can't actually see in
//     the data (no kalman filters, no exponential decay assumptions),
//   - low R² is grounds for honest abstention (return null).
//
// Honesty rules — every one of these triggers null (no badge):
//   1. < 5 days span between earliest and latest observation. The user
//      explicitly calibrated this threshold: long enough to be more
//      than noise, short enough to be useful before the trend dies.
//   2. < 3 observations after filtering nulls. A two-point line gives
//      perfect R² mechanically — that's not signal, it's geometry.
//   3. slope >= -0.5 score/day. A flat or rising trend has no decay
//      to forecast. We will not invent one.
//   4. R² < 0.3. The fit is too noisy to project — saying "decays in
//      4d" when the data wobbles ±20 points/day would be a fabrication.
//   5. Forecast horizon > 7 days from now. A nearly-flat slope can
//      mathematically predict "decays in 47 days" — that's noise, not
//      a forecast.
//   6. current_score already at or below threshold. Already decayed —
//      nothing to project.
//
// Threshold: virality_score = 30. Below this, our scoring already
// treats a trend as weak — that's the natural "no longer worth posting"
// line. Tunable via constant if calibration changes.
type DecayForecast = {
  est_decays_below_at: string;
  decay_threshold: number;
  current_score: number;
  slope_per_day: number;
  history_span_days: number;
  observation_count: number;
  r_squared: number;
};

function computeDecayForecast(
  history: Array<{ observed_at: string; virality_score: number | null }> | undefined,
  now: Date = new Date(),
): DecayForecast | null {
  const DECAY_THRESHOLD = 30;
  const MIN_SPAN_DAYS = 5;
  const MIN_POINTS = 3;
  const MIN_DECAY_SLOPE = -0.5; // score/day; less negative than this = "not declining"
  const MIN_R_SQUARED = 0.3;
  const MAX_FORECAST_DAYS = 7;

  if (!history || history.length < MIN_POINTS) return null;

  const points = history
    .filter(o => o.virality_score != null)
    .map(o => ({
      t: new Date(o.observed_at).getTime(),
      v: o.virality_score as number,
    }))
    .filter(p => !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t);
  if (points.length < MIN_POINTS) return null;

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const spanDays = (tMax - tMin) / 86_400_000;
  if (spanDays < MIN_SPAN_DAYS) return null;

  // Linear regression: x = days from earliest obs, y = virality_score.
  const xs = points.map(p => (p.t - tMin) / 86_400_000);
  const ys = points.map(p => p.v);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  if (slope >= MIN_DECAY_SLOPE) return null; // flat or rising — no decay to forecast

  const intercept = meanY - slope * meanX;

  // R² — quality of fit. Low R² means the line is a poor explanation
  // of the data; we abstain rather than forecast off noise.
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yPred = intercept + slope * xs[i];
    ssRes += (ys[i] - yPred) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  if (rSquared < MIN_R_SQUARED) return null;

  const currentScore = ys[ys.length - 1];
  if (currentScore <= DECAY_THRESHOLD) return null; // already decayed — nothing to project

  // Solve for x where y = threshold: x = (threshold - intercept) / slope.
  const xAtThreshold = (DECAY_THRESHOLD - intercept) / slope;
  const nowX = (now.getTime() - tMin) / 86_400_000;
  const daysFromNow = xAtThreshold - nowX;
  if (daysFromNow <= 0) return null;            // line says we should have already crossed
  if (daysFromNow > MAX_FORECAST_DAYS) return null; // too far out — slope too flat to trust

  const estTime = new Date(now.getTime() + daysFromNow * 86_400_000);
  return {
    est_decays_below_at: estTime.toISOString(),
    decay_threshold: DECAY_THRESHOLD,
    current_score: currentScore,
    slope_per_day: Math.round(slope * 10) / 10,
    history_span_days: Math.round(spanDays * 10) / 10,
    observation_count: n,
    r_squared: Math.round(rSquared * 100) / 100,
  };
}

// Tier 3 / Fix #4 — Story-arc clustering.
//
// The problem: every trend has a unique trend_id, but multiple trends can
// belong to the same news cycle. "Olivia Rodrigo Presale", "Olivia Rodrigo
// Tour Dates", "Olivia Rodrigo SNL" are three separate rows with three
// scores — and without intervention the LLM can pick all three of them
// as 3 of the user's 5 recommendations. That's not five trends, that's
// one trend in a trench coat.
//
// Solution: cluster trends that share ≥2 significant tokens (length ≥ 4,
// stopwords stripped) using union-find — transitive grouping so A↔B and
// B↔C means A, B, C are one arc. Tell the LLM about each candidate's
// arc_id and cluster size and instruct it to pick AT MOST ONE per arc.
// Surface the rest as `alternates` on the chosen rec so the UI can offer
// "2 more in this arc" without burning a slot.
//
// Honesty rules:
//   • Cluster decisions must be explainable. We expose the literal
//     `shared_tokens` on every clustered trend so the user can verify
//     the merge ("oh, both about 'Rodrigo' + 'tour' — yes, same arc").
//   • Coincidental overlap is filtered by requiring ≥2 shared tokens of
//     length ≥4. "movie news" by itself shouldn't cluster two unrelated
//     movies.
//   • A singleton (no peers) gets NO arc field. We never invent a
//     cluster of one.
//   • The chosen rep is the highest-virality member of the cluster —
//     deterministic, ties broken by trend_id for stability across runs.

// Tight stopword list. Includes trend-corpus filler ("buzz", "spotlight"),
// generic time/event words ("season", "episode", "recent"), and obvious
// English filler. Adding too many breaks legitimate clustering — adding
// too few causes false merges. This list errs toward NOT clustering.
const ARC_STOPWORDS = new Set([
  'trend', 'trends', 'trending', 'video', 'videos', 'show', 'shows',
  'spotlight', 'buzz', 'discussion', 'discussions', 'controversy', 'drama',
  'celebrations', 'season', 'episode', 'series', 'movie', 'movies', 'film',
  'films', 'star', 'stars', 'with', 'from', 'this', 'that', 'about', 'their',
  'recent', 'making', 'gaining', 'being', 'currently', 'after', 'before',
  'into', 'when', 'over', 'fans', 'social', 'media', 'just', 'have', 'they',
  'will', 'would', 'could', 'should', 'what', 'which', 'where', 'because',
  'people', 'world', 'sparking', 'attention', 'released', 'launched',
  'announced', 'reveal', 'reveals', 'revealed',
]);

type ArcAlternate = {
  trend_id: string;
  trend_name: string;
  virality_score: number | null;
};

type ArcInfo = {
  arc_id: string;
  cluster_size: number;
  is_arc_rep: boolean;
  rep_trend_id: string;
  shared_tokens: string[];
  alternates: ArcAlternate[];
};

function arcExtractTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 4 && !ARC_STOPWORDS.has(t))
  );
}

/**
 * Cluster the given trends by shared significant-token overlap. Returns
 * a Map keyed by trend_id. Trends in singleton clusters are absent from
 * the map — callers should treat "no entry" as "no arc context".
 */
function buildArcs(trends: Array<{
  trend_id: string;
  trend_name: string;
  description?: string | null;
  virality_score?: number | null;
}>): Map<string, ArcInfo> {
  const out = new Map<string, ArcInfo>();
  if (!trends || trends.length < 2) return out;

  // Tokenize ONLY trend_name. Descriptions introduce too much shared
  // filler vocabulary ("prominent", "industry", "spotlight") and a
  // pairwise ≥2-token threshold compounds via union-find into runaway
  // mega-clusters. Names are short and discriminating — if two names
  // share ≥2 significant tokens, they're almost certainly the same arc.
  const tokens = trends.map(t => arcExtractTokens(t.trend_name || ''));

  // Union-find with path compression.
  const parent = trends.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Pairwise check — O(N²) on a set of 30 candidates is trivial (<1k ops).
  for (let i = 0; i < trends.length; i++) {
    for (let j = i + 1; j < trends.length; j++) {
      let shared = 0;
      for (const tok of tokens[i]) {
        if (tokens[j].has(tok)) {
          shared++;
          if (shared >= 2) break;
        }
      }
      if (shared >= 2) union(i, j);
    }
  }

  // Group by root.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < trends.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Emit ArcInfo for clusters of ≥2.
  for (const [root, members] of groups) {
    if (members.length < 2) continue;

    // Shared tokens across the WHOLE cluster (intersection of all members).
    let sharedAcrossCluster = new Set(tokens[members[0]]);
    for (let m = 1; m < members.length; m++) {
      const next = new Set<string>();
      for (const tok of sharedAcrossCluster) {
        if (tokens[members[m]].has(tok)) next.add(tok);
      }
      sharedAcrossCluster = next;
    }
    const sharedTokensList = [...sharedAcrossCluster].sort();

    // Rep = highest virality_score; tiebreak on trend_id ascending for
    // determinism across fetch runs.
    const sortedMembers = [...members].sort((ai, bi) => {
      const va = trends[ai].virality_score ?? -Infinity;
      const vb = trends[bi].virality_score ?? -Infinity;
      if (vb !== va) return vb - va;
      return trends[ai].trend_id.localeCompare(trends[bi].trend_id);
    });
    const repIdx = sortedMembers[0];
    const repTrendId = trends[repIdx].trend_id;
    const arcId = `arc_${repTrendId}`; // stable, content-addressed

    for (const i of members) {
      const alternates: ArcAlternate[] = members
        .filter(j => j !== i)
        .map(j => ({
          trend_id: trends[j].trend_id,
          trend_name: trends[j].trend_name,
          virality_score: trends[j].virality_score ?? null,
        }))
        .sort((a, b) => (b.virality_score ?? -Infinity) - (a.virality_score ?? -Infinity));
      out.set(trends[i].trend_id, {
        arc_id: arcId,
        cluster_size: members.length,
        is_arc_rep: i === repIdx,
        rep_trend_id: repTrendId,
        shared_tokens: sharedTokensList,
        alternates,
      });
    }
  }

  return out;
}

type BrandMemory = {
  user_id: string | null;
  brand_name: string;
  business_summary?: string | null;
  voice_profile_text?: string | null;
  do_list?: string[] | null;
  dont_list?: string[] | null;
  preferred_formats?: string[] | null;
  tone_preferences?: any | null;
};

async function getBrandMemory(
  supabase: any,
  userId: string | null,
  brandName: string
): Promise<BrandMemory | null> {
  if (userId) {
    const { data: userMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("brand_name", brandName)
      .maybeSingle();

    if (userMemory) return userMemory;

    const { data: sharedMemory } = await supabase
      .from("brand_memory")
      .select("*")
      .is("user_id", null)
      .eq("brand_name", brandName)
      .maybeSingle();

    return sharedMemory;
  }

  const { data } = await supabase
    .from("brand_memory")
    .select("*")
    .is("user_id", null)
    .eq("brand_name", brandName)
    .maybeSingle();

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_profile, user_id, selected_categories } = await req.json();
    console.log('Received user_profile:', user_profile, 'user_id:', user_id || 'anonymous', 'categories:', selected_categories || 'all');

    if (!user_profile || !user_profile.brand_name) {
      return new Response(
        JSON.stringify({ error: 'user_profile with brand_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize EXTERNAL Supabase client (user's project with trends data)
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);

    // Fetch brand memory
    const userId = user_id || null;
    const brandName = user_profile.brand_name || "Unknown Brand";
    const brandMemory = await getBrandMemory(externalSupabase, userId, brandName);
    console.log('Brand memory:', brandMemory ? 'found' : 'not found');

    // Fetch candidate trends from external Supabase (optionally filtered by category)
    const categories: string[] = Array.isArray(selected_categories) && selected_categories.length > 0
      ? selected_categories
      : [];

    // We deliberately do NOT select views_last_60h_millions here — we don't
    // currently have a real view-count signal source, so that field is always
    // NULL. Asking the LLM to optimise for it is meaningless. We rank by
    // virality_score (computed from cross-source corroboration + timing)
    // and let brand-fit be the LLM's job.
    let query = externalSupabase
      .from('trends')
      .select('trend_id, trend_name, description, hashtags, region, premium_only, active, timing, ig_confirmed, ig_validated, virality_score, source_signals, corroboration_score, corroboration_max, first_seen_at, last_seen_at, peaked_at, peak_virality_score, category, yt_video_id, yt_video_title, yt_channel_title, yt_view_count, yt_like_count, yt_comment_count, yt_video_published_at, yt_fetched_at, yt_top_publishers')
      .eq('premium_only', false)
      .eq('active', true)
      .order('virality_score', { ascending: false })
      .limit(30);

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data: trends, error: trendsError } = await query;

    if (trendsError) {
      console.error('External Supabase error:', trendsError);
      throw new Error('Failed to fetch trends from external database');
    }

    if (!trends || trends.length === 0) {
      console.log('No trends found');
      return new Response(
        JSON.stringify({ recommended_trends: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${trends.length} candidate trends from external Supabase`);

    // Try to get Marketers Quest recommendations
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Tier 3 / Fix #4 — Build story-arc clusters BEFORE the LLM sees
      // the trends so we can warn it not to pick three flavors of the
      // same news cycle. Map keyed by trend_id; trends in singleton
      // clusters are absent.
      const arcMap = buildArcs(trends);

      // Lock in the 2 highest-virality trends so the LLM can't drop them
      // for a marginal "brand fit" pick. Virality_score is computed from
      // cross-source corroboration + timing in fetch-trends — not the
      // (always-NULL) views_last_60h_millions placeholder we used to use.
      //
      // Arc-aware: if the top two trends share an arc, lock in only one
      // (the higher-scored) and replace the second with the next-highest
      // trend from a DIFFERENT arc. Otherwise we'd be force-feeding the
      // user duplicate news-cycle picks.
      const top2TrendIds: string[] = [];
      const lockedArcs = new Set<string>();
      for (const t of trends) {
        if (top2TrendIds.length >= 2) break;
        const arc = arcMap.get(t.trend_id);
        const arcKey = arc ? arc.arc_id : `solo:${t.trend_id}`;
        if (lockedArcs.has(arcKey)) continue;
        top2TrendIds.push(t.trend_id);
        lockedArcs.add(arcKey);
      }

      const systemPrompt = `You are a senior social media strategist for high-growth creators and brands.

Your job:
- Read a brand profile.
- Read a list of current social media trends. Each one comes with:
  - a description of WHY it is trending right now,
  - a virality_score (10–99) reflecting cross-source corroboration + timing,
  - a timing label (early / peaking / saturated),
  - source_signals (which raw signals confirmed it: google_trends_uk, reddit, youtube_us, etc.),
  - a corroboration_score and corroboration_max — score = how many DISTINCT platforms confirmed this trend; max = how many platforms we successfully reached this run (out of Google Trends / Reddit / YouTube). When score == max the trend has full coverage of the platforms we could check; when max < 3, that's because one of the platforms (currently Reddit) was unreachable this run. NEVER tell the user a trend is "missing a platform" if score == max — that's full coverage of available sources.
  - optional yt_view_count / yt_like_count — REAL YouTube engagement on the best-matching recent video for this trend. When present, this is externally-verifiable proof that audiences are actually engaging (not just searching). When null, it just means we couldn't find a qualifying recent video — treat it as "no extra evidence", NOT as "this trend has no reach".
  - optional yt_velocity — derived from yt_view_count divided by hours since the matched video was uploaded. Tiers: 'racing' (≥20K views/hr), 'strong' (≥5K/hr), 'steady' (≥1K/hr), 'slow' (<1K/hr). When tier is 'racing' or 'strong', cite it as evidence the trend is actively accelerating. When null, treat it as "we couldn't compute a rate yet" (video too new, or no matched video) — never as "the trend is dead". The tier is a snapshot of the recent past, NOT a forecast — phrase any reference past-tense ("pulled X views in Yh since upload"), never "will hit N views".
  - optional arc_id and arc_cluster_size — trends with the same arc_id are different angles on the same news cycle (e.g., three "Olivia Rodrigo" entries: presale, tour dates, SNL). They share ≥2 significant words in their names/descriptions. Pick AT MOST ONE per arc_id — the user has 5 slots and three flavors of one story is one story, not three. When you skip a trend because of arc deduplication, choose the one with the strongest brand fit, not just the highest virality_score within the arc. Trends WITHOUT an arc_id are unique news cycles and don't conflict with anything.
  - a category and region.
- Pick exactly 5 trends that will perform best for this brand.

Brand memory is provided as a style guide. Use it as the highest priority for voice and tone:
- Match the rhythm and attitude described in voice_profile_text.
- Follow do_list and avoid dont_list.
- If tone_preferences exist, use primary_tones and intensity_preference as extra guidance together with the current tone and tone_intensity controls.

Tone handling:
- The brand tone may include multiple styles (tones array). Use primary_tone as the main voice.
- Use tone_intensity (1–5) to control how strongly the tone is expressed:
  1–2 mild, 3 balanced, 4–5 strong, bold, creator-grade.
- If primary_tone is 'Naughty', allow premium A-rated innuendo but keep it non-explicit and brand-safe.

Rules:
- ALWAYS include the 2 anchor trends from the top of the list (these are the strongest distinct signals available right now — already arc-deduplicated, so they're guaranteed to be different news cycles).
- HARD RULE: Pick at most ONE trend per arc_id. If you find yourself wanting to pick two trends with the same arc_id, drop the weaker fit and use the slot for a different arc.
- For the other 3:
  - Optimise for brand fit (industry, niche, audience, tone, content_format, primary_goal).
  - Prefer trends with timing="early" when brand can move fast — first-mover advantage.
  - Prefer trends with corroboration_score ≥ 2. A single-platform trend (corroboration_score=1) can be a real trend or just one platform's noise — only pick it if the brand fit is unusually strong AND the description's WHY is concrete and verifiable.
  - When yt_view_count is present, factor it in as proof of real reach (e.g., 1M+ views = strong external validation). Cite the specific number in why_good_fit when it materially supports the pick. Never claim engagement we don't have — if yt_view_count is null, do NOT invent a number or imply YouTube has zero reach.
  - Skip saturated trends unless the brand has a genuinely fresh angle.
- Use the description field: reference specific triggers (leaks, finales, controversies, emotional themes, flashmobs, etc.), not generic statements.
- Avoid clichés like:
  - 'engaging content'
  - 'resonates with your audience'
  - 'leveraging this trend'
  - 'drive engagement'.
- Write like a human creative partner, not a corporate strategist.

For each selected trend you must return:
- trend_id (matching one from the input),
- why_good_fit (2–3 punchy sentences using brand language and the real reasons the trend is hot — cite a specific moment from the description, never a generic claim),
- example_hook (ONE scroll-stopping hook line, max ~140 characters, which can start with an emoji or CAPS),
- angle_summary (1–2 sentences describing the creative angle, not a repeat of why_good_fit).

Always respond with a single valid JSON object.`;

      const trendsForPrompt = trends.map(t => ({
        trend_id: t.trend_id,
        trend_name: t.trend_name,
        description: t.description || '',
        hashtags: t.hashtags || '',
        virality_score: t.virality_score ?? null,
        timing: t.timing || null,
        source_signals: t.source_signals || [],
        corroboration_score: t.corroboration_score ?? 1,
        // Tier 3 / Fix #3 — number of platforms reached this run. Lets the
        // LLM reason about score/max ratios honestly instead of comparing
        // every trend against a hardcoded /3.
        corroboration_max: (t as any).corroboration_max ?? null,
        // Real YouTube engagement evidence (Tier 2 / Fix #6). Null when no
        // qualifying match was found — the LLM is instructed to treat null
        // as "no extra evidence", never as "zero reach".
        yt_view_count: (t as any).yt_view_count ?? null,
        yt_like_count: (t as any).yt_like_count ?? null,
        yt_channel_title: (t as any).yt_channel_title ?? null,
        // Tier 3 / Fix #5 — accelerating-reach signal. Computed inline so
        // the LLM can weight it. Returns null when video was published
        // <3h ago or when either yt_view_count / yt_video_published_at
        // is missing — the LLM is instructed to treat null as "no extra
        // evidence", never as "trend is dead".
        yt_velocity: computeYouTubeVelocity(
          (t as any).yt_view_count,
          (t as any).yt_video_published_at,
        ),
        // Tier 3 / Fix #4 — arc grouping. arc_id is a stable cluster
        // identifier; arc_cluster_size tells the LLM how many other trends
        // in this list belong to the same news cycle. Both are absent for
        // singleton trends — that's the signal "this trend stands alone".
        arc_id: arcMap.get(t.trend_id)?.arc_id ?? null,
        arc_cluster_size: arcMap.get(t.trend_id)?.cluster_size ?? null,
        category: t.category || null,
        region: t.region || null,
      }));

      const userMessage = `
Here is the brand profile:
${JSON.stringify(user_profile, null, 2)}

Here is the brand memory (style guide):
${JSON.stringify(brandMemory, null, 2)}

Here is the list of candidate trends (ranked by virality_score, with descriptions of why they are currently viral):
${JSON.stringify(trendsForPrompt, null, 2)}

The 2 trends with the highest virality_score are: ${top2TrendIds.join(', ')} — you MUST include these.

Please select exactly 5 trends and return a JSON object like:

{
  "recommended_trends": [
    {
      "trend_id": "T001",
      "why_good_fit": "2–3 punchy sentences.",
      "example_hook": "One scroll-stopping hook line, max ~140 characters.",
      "angle_summary": "1–2 sentences describing the creative angle."
    }
  ]
}

Focus on very concrete reasons this trend works for this specific brand. Do NOT use generic marketing buzzwords.
`;

      console.log('Calling Marketers Quest API...');
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('Marketers Quest API error:', openaiResponse.status, errorText);
        throw new Error(`Marketers Quest API call failed: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in Marketers Quest response');
      }

      console.log('Marketers Quest response received, parsing...');
      const parsedResponse = JSON.parse(content);

      // Build a map for quick trend lookup
      const trendMap = new Map();
      trends.forEach(t => trendMap.set(t.trend_id, t));

      // Tier 3 / Fix #1 — fetch observation history ONLY for the trends
      // the LLM picked, not all 30 candidates. Single round trip.
      const pickedTrendIds: string[] = (parsedResponse.recommended_trends || [])
        .map((r: any) => r.trend_id)
        .filter((id: any): id is string => typeof id === 'string');
      const observationHistoryMap = await fetchObservationHistory(externalSupabase, pickedTrendIds);

      // Tier 3 / Fix #2 — competitor coverage. Compute per-trend, using
      // the user's profile.competitors list (may be empty/undefined).
      const userCompetitors: Competitor[] = Array.isArray(user_profile?.competitors)
        ? user_profile.competitors
        : [];

      // Map Marketers Quest recommendations to full trend objects
      const recommended_trends = parsedResponse.recommended_trends
        .map((rec: any) => {
          const fullTrend = trendMap.get(rec.trend_id);
          if (!fullTrend) {
            console.warn(`Trend ${rec.trend_id} not found in database`);
            return null;
          }
          // yt_top_publishers comes back as JSONB (object/array) or null.
          // Pass through the null distinction so computeCompetitorCoverage
          // can return its honest "couldn't check" verdict.
          const rawPublishers = (fullTrend as any).yt_top_publishers;
          const publishers: YouTubePublisher[] | null = rawPublishers === null || rawPublishers === undefined
            ? null
            : (Array.isArray(rawPublishers) ? rawPublishers : []);
          const competitor_coverage = computeCompetitorCoverage(publishers, userCompetitors);
          return {
            trend_id: fullTrend.trend_id,
            trend_name: fullTrend.trend_name,
            // views_last_60h_millions intentionally omitted — we no longer fake it.
            region: fullTrend.region || null,
            timing: fullTrend.timing || 'peaking',
            ig_confirmed: fullTrend.ig_confirmed ?? null,
            ig_validated: fullTrend.ig_validated ?? 'unknown',
            virality_score: fullTrend.virality_score ?? null,
            source_signals: fullTrend.source_signals || [],
            corroboration_score: fullTrend.corroboration_score ?? 1,
            // Tier 3 / Fix #3 — number of platforms the fetch run actually
            // checked. UI renders score/max so 2/2 (perfect coverage of
            // available sources) stops looking like 2/3 (partial). NULL
            // on legacy rows; UI must fall back to score-only display.
            corroboration_max: (fullTrend as any).corroboration_max ?? null,
            // Lifecycle history. peaked_at can be NULL (no observed peak
            // drop yet), and that's intentional — UI must distinguish
            // "still climbing" (NULL) from "peaked Xh ago" (timestamp).
            first_seen_at: fullTrend.first_seen_at ?? null,
            last_seen_at: fullTrend.last_seen_at ?? null,
            peaked_at: fullTrend.peaked_at ?? null,
            peak_virality_score: fullTrend.peak_virality_score ?? null,
            // Real YouTube engagement evidence. All null when no qualifying
            // match was found — UI MUST hide the engagement badge entirely
            // in that case (showing "0 views" would be a fabrication).
            yt_video_id: (fullTrend as any).yt_video_id ?? null,
            yt_video_title: (fullTrend as any).yt_video_title ?? null,
            yt_channel_title: (fullTrend as any).yt_channel_title ?? null,
            yt_view_count: (fullTrend as any).yt_view_count ?? null,
            yt_like_count: (fullTrend as any).yt_like_count ?? null,
            yt_comment_count: (fullTrend as any).yt_comment_count ?? null,
            yt_video_published_at: (fullTrend as any).yt_video_published_at ?? null,
            yt_fetched_at: (fullTrend as any).yt_fetched_at ?? null,
            // Tier 3 / Fix #5 — accelerating-reach signal derived from real
            // YT data we already have. NULL when the matched video is too
            // new (< 3h) or no match exists. UI MUST hide the badge in that
            // case — claiming "slow" with no data would be a fabrication.
            yt_velocity: computeYouTubeVelocity(
              (fullTrend as any).yt_view_count,
              (fullTrend as any).yt_video_published_at,
            ),
            // Time-series observation history (Tier 3 / Fix #1). Up to 14
            // most recent observations, ascending by observed_at. UI MUST
            // hide the sparkline if length < 2.
            observation_history: observationHistoryMap.get(fullTrend.trend_id) || [],
            // Tier 3 / Fix #6 — decay forecast. Linear projection of when
            // virality_score crosses the "no longer worth posting" line.
            // NULL when history is too thin (< 5 days span / < 3 obs),
            // when the trend is flat or rising, when fit is too noisy
            // (R² < 0.3), or when projected horizon > 7 days. UI MUST
            // render NULL as "no forecast available", never as "won't decay".
            decay_forecast: computeDecayForecast(observationHistoryMap.get(fullTrend.trend_id)),
            // Tier 3 / Fix #4 — story-arc context. NULL when this trend is
            // a singleton (no other candidates share its news cycle); the
            // shape always includes shared_tokens and alternates so the UI
            // can render an explainable "X more in this arc" badge.
            arc: arcMap.get(fullTrend.trend_id) ?? null,
            // Tier 3 / Fix #2 — competitor coverage. publishers===null
            // means we couldn't check; UI MUST render that as ambiguous
            // and never as a positive first-mover claim.
            competitor_coverage,
            category: fullTrend.category || null,
            why_good_fit: rec.why_good_fit || '',
            example_hook: rec.example_hook || '',
            angle_summary: rec.angle_summary || ''
          };
        })
        .filter(Boolean);

      console.log(`Returning ${recommended_trends.length} AI-powered recommendations`);
      return new Response(
        JSON.stringify({ recommended_trends }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      // Honest fallback when OpenAI is down or rate-limited.
      //
      // Old fallback returned 5× "This is a strong fit because it is a
      // high-attention global trend" — generic boilerplate that destroys
      // trust on the first outage.
      //
      // New fallback uses the trend's actual stored description (which we
      // already have, sourced from real signals) plus the timing/category
      // signal to produce a meaningful why_good_fit per trend. We also
      // surface the degraded mode to the client so the UI can label it
      // honestly ("Live AI ranking unavailable — showing top trends by
      // signal strength").
      console.error('AI recommendation failed, using signal-only fallback:', aiError);

      const firstSentence = (text: string | null | undefined): string => {
        if (!text) return '';
        const trimmed = text.trim();
        const m = trimmed.match(/^[^.!?]+[.!?]/);
        return (m ? m[0] : trimmed.slice(0, 220)).trim();
      };

      const timingPhrase = (t: string | null | undefined): string => {
        if (t === 'early') return 'Early signal — Instagram aggregators have not posted yet, so first-mover advantage is still on the table';
        if (t === 'peaking') return 'Peaking right now — still room to ride the wave but speed matters';
        if (t === 'saturated') return 'Already widespread — only worth posting with a genuinely fresh angle';
        return 'Currently in active rotation across multiple platforms';
      };

      // Tier 3 / Fix #4 — Same arc-dedup the AI path enforces, but now
      // it's our job (no LLM in this branch). Walk the candidates in
      // virality order and skip any whose arc is already represented.
      // Without this, a Reddit-style "Olivia presale / Olivia tour /
      // Olivia SNL" cluster could fill 3 of the 5 fallback slots.
      const fallbackArcMap = buildArcs(trends);
      const fallbackPicked: typeof trends = [];
      const fallbackArcsUsed = new Set<string>();
      for (const t of trends) {
        if (fallbackPicked.length >= 5) break;
        const arc = fallbackArcMap.get(t.trend_id);
        const arcKey = arc ? arc.arc_id : `solo:${t.trend_id}`;
        if (fallbackArcsUsed.has(arcKey)) continue;
        fallbackPicked.push(t);
        fallbackArcsUsed.add(arcKey);
      }

      // Same observation-history fetch as the AI path — keep parity so
      // sparklines render in the degraded mode too.
      const fallbackTrendIds = fallbackPicked.map(t => t.trend_id);
      const observationHistoryMap = await fetchObservationHistory(externalSupabase, fallbackTrendIds);

      // Tier 3 / Fix #2 — competitor coverage. Same intent as AI path.
      const userCompetitors: Competitor[] = Array.isArray(user_profile?.competitors)
        ? user_profile.competitors
        : [];

      const fallbackTrends = fallbackPicked.map(trend => {
        const description = (trend as any).description || '';
        const timing = (trend as any).timing || null;
        const sources: string[] = (trend as any).source_signals || [];
        const corroboration: number = (trend as any).corroboration_score ?? 1;
        const corroborationMax: number | null = (trend as any).corroboration_max ?? null;
        const category = (trend as any).category || null;

        const ytViews: number | null = (trend as any).yt_view_count ?? null;
        const ytLikes: number | null = (trend as any).yt_like_count ?? null;

        // Same null/array discrimination as the AI path — preserve the
        // null distinction so "couldn't check" stays distinct from
        // "checked, found zero".
        const rawPublishers = (trend as any).yt_top_publishers;
        const publishers: YouTubePublisher[] | null = rawPublishers === null || rawPublishers === undefined
          ? null
          : (Array.isArray(rawPublishers) ? rawPublishers : []);
        const competitor_coverage = computeCompetitorCoverage(publishers, userCompetitors);

        const lead = firstSentence(description) ||
          `${trend.trend_name} is currently active${category ? ` in the ${category} space` : ''}.`;
        // Tier 3 / Fix #3 — frame corroboration against the platforms we
        // actually reached this run, not a hardcoded /3. A 2/2 trend has
        // full coverage and reads as such. Legacy rows (corroboration_max
        // null) keep the simpler "N distinct platforms" copy.
        const signalLine = corroboration >= 2
          ? (corroborationMax !== null && corroboration >= corroborationMax
              ? `Full corroboration across ${corroboration}/${corroborationMax} platforms checked (${sources.slice(0, 3).join(', ')}).`
              : `Confirmed across ${corroboration} distinct platforms (${sources.slice(0, 3).join(', ')}).`)
          : sources.length > 0
            ? `Single-platform signal so far (${sources[0]}) — verify before posting.`
            : `Surfaced from cross-source aggregation.`;
        // Only mention YouTube reach when we actually have a number. NULL =
        // we couldn't find a qualifying match; we will not fabricate or
        // imply the trend has no reach.
        const ytLine = ytViews !== null
          ? ` Recent YouTube uploads on this topic are pulling ${ytViews.toLocaleString()} views${ytLikes !== null ? ` / ${ytLikes.toLocaleString()} likes` : ''}.`
          : '';
        // Tier 3 / Fix #5 — append a past-tense velocity note when the
        // matched video is racing or strong. Strict past-tense framing —
        // never "will hit X" (that's a forecast we can't make).
        const velocity = computeYouTubeVelocity(
          ytViews,
          (trend as any).yt_video_published_at,
        );
        const velocityLine = velocity && (velocity.tier === 'racing' || velocity.tier === 'strong')
          ? ` That's ${velocity.views.toLocaleString()} views in ${velocity.hours_since_publish}h since upload — accelerating right now.`
          : '';

        return {
          trend_id: trend.trend_id,
          trend_name: trend.trend_name,
          region: (trend as any).region || null,
          timing,
          ig_confirmed: (trend as any).ig_confirmed ?? null,
          ig_validated: (trend as any).ig_validated ?? 'unknown',
          virality_score: (trend as any).virality_score ?? null,
          source_signals: sources,
          corroboration_score: corroboration,
          corroboration_max: (trend as any).corroboration_max ?? null,
          first_seen_at: (trend as any).first_seen_at ?? null,
          last_seen_at: (trend as any).last_seen_at ?? null,
          peaked_at: (trend as any).peaked_at ?? null,
          peak_virality_score: (trend as any).peak_virality_score ?? null,
          yt_video_id: (trend as any).yt_video_id ?? null,
          yt_video_title: (trend as any).yt_video_title ?? null,
          yt_channel_title: (trend as any).yt_channel_title ?? null,
          yt_view_count: ytViews,
          yt_like_count: ytLikes,
          yt_comment_count: (trend as any).yt_comment_count ?? null,
          yt_video_published_at: (trend as any).yt_video_published_at ?? null,
          yt_fetched_at: (trend as any).yt_fetched_at ?? null,
          // Tier 3 / Fix #5 — same velocity signal as AI path. Keeps parity
          // when AI ranking is degraded.
          yt_velocity: computeYouTubeVelocity(
            ytViews,
            (trend as any).yt_video_published_at,
          ),
          observation_history: observationHistoryMap.get(trend.trend_id) || [],
          // Tier 3 / Fix #6 — decay forecast (same contract as AI path).
          decay_forecast: computeDecayForecast(observationHistoryMap.get(trend.trend_id)),
          // Tier 3 / Fix #4 — story-arc context. Even though the fallback
          // already arc-deduped its 5 picks, we still surface alternates
          // here so the user can see "and 2 more in this arc" if their
          // chosen trend is part of a wider news cycle.
          arc: fallbackArcMap.get(trend.trend_id) ?? null,
          competitor_coverage,
          category,
          why_good_fit: `${lead} ${timingPhrase(timing)}. ${signalLine}${ytLine}${velocityLine}`.trim(),
          example_hook: `${trend.trend_name}${category ? ` × ${user_profile.brand_name}` : ''} — here's the angle nobody's posted yet.`,
          angle_summary: `Tie ${trend.trend_name} into ${user_profile.brand_name}'s ${user_profile.niche || user_profile.industry || 'core message'} by leading with the specific moment driving the trend (see description), then bridging to the brand's POV.`,
        };
      });

      return new Response(
        JSON.stringify({
          recommended_trends: fallbackTrends,
          degraded: true,
          degraded_reason: 'ai_ranking_unavailable',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in recommend-trends function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', recommended_trends: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
