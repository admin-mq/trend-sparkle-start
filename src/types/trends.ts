export interface Competitor {
  name: string;
  domain: string;
  type: 'local' | 'national' | 'global' | 'manual';
  why_relevant: string;
  is_aspirational: boolean;
}

export type Platform = 'Twitter' | 'Instagram' | 'TikTok' | 'LinkedIn' | 'YouTube';
export type TwitterUserType = 'standard' | 'premium';

export interface UserProfile {
  brand_name: string;
  business_summary?: string;
  industry: string;
  niche: string;
  audience: string;
  geography: string;
  tone: string;
  tones?: string[];
  primary_tone?: string;
  tone_intensity?: number;
  tone_meter_label?: string;
  content_format: string;
  primary_goal: string;
  competitors?: Competitor[];
  // New fields
  platform?: Platform;
  topic_angle?: string;
  content_categories?: string[];
  twitter_geography?: string;
  twitter_user_type?: TwitterUserType;
  is_faceless?: boolean;
}

export type TrendTiming = 'early' | 'peaking' | 'saturated';

/**
 * Tri-state IG aggregator validation.
 * - 'confirmed' → IG aggregator post(s) found for the trend
 * - 'not_found' → IG search ran cleanly and reported zero matches
 * - 'unknown'   → validation step did not classify this trend (timeout,
 *                 parse error, or model omitted it). UI MUST render this
 *                 as ambiguous, never as a negative.
 */
export type IgValidated = 'confirmed' | 'not_found' | 'unknown';

export type TrendCategory =
  | 'Entertainment'
  | 'Sports'
  | 'Music'
  | 'Tech'
  | 'News'
  | 'Fashion'
  | 'Food'
  | 'Gaming'
  | 'Finance'
  | 'Lifestyle'
  | 'Entrepreneurship';

export interface Trend {
  trend_id: string;
  trend_name: string;
  views_last_60h_millions: number | null;
  region?: string;
  timing?: TrendTiming;
  /** @deprecated Prefer ig_validated. Kept for back-compat with old API responses. */
  ig_confirmed?: boolean;
  ig_validated?: IgValidated;
  virality_score?: number;
  source_signals?: string[];
  /**
   * Number of *distinct platforms* (Google Trends, Reddit, YouTube) that
   * confirmed this trend. 1 = single-platform (treat as weaker signal),
   * 2 = corroborated, 3 = fully corroborated across all platforms checked.
   * Surfaced to users as a credibility badge — single-source trends should
   * be labeled "verify before posting" so users know the signal is thinner.
   */
  corroboration_score?: number;
  /**
   * Tier 3 / Fix #3 — Number of distinct platforms the fetch run actually
   * reached when this trend was last upserted. Render UI as
   * `corroboration_score / corroboration_max` so a 2/2 trend (perfect
   * coverage of the platforms we could check) stops looking weaker than
   * a 2/3 trend (one platform reached but didn't corroborate).
   *
   * NULL on rows from before this field shipped — UI must fall back
   * gracefully (e.g. show "N platforms" without a denominator). When
   * Reddit comes back online, max naturally bumps from 2 to 3 with no
   * UI change required.
   */
  corroboration_max?: number | null;
  /**
   * The very first time we observed this trend in our pipeline. Set on
   * insert, never overwritten. Powers "broke Xh ago" copy.
   */
  first_seen_at?: string | null;
  /** Most recent observation timestamp. Refreshed every fetch run. */
  last_seen_at?: string | null;
  /**
   * When the current peak virality score was reached. NULL means we
   * haven't seen a virality drop yet (i.e. still climbing). UI must
   * distinguish "still climbing" (null) from "peaked Xh ago" (timestamp)
   * — never silently treat null as "now".
   */
  peaked_at?: string | null;
  /** Highest virality_score ever recorded for this trend. */
  peak_virality_score?: number | null;
  // ── Real YouTube engagement (Tier 2 / Fix #6) ──────────────────────────────
  // All eight yt_* fields travel together: present together when a qualifying
  // recent video was matched (≥10K views), null together when no match was
  // found OR YOUTUBE_API_KEY isn't configured. UI MUST hide the engagement
  // badge when yt_video_id is null — rendering "0 views" would falsely imply
  // we checked and the video flopped.
  /** YouTube videoId of the best-matching recent video. NULL = no match. */
  yt_video_id?: string | null;
  /** Title of the matched YouTube video. */
  yt_video_title?: string | null;
  /** Channel name of the matched YouTube video. */
  yt_channel_title?: string | null;
  /** Real view count from YouTube Data API at last fetch. NULL when no match. */
  yt_view_count?: number | null;
  /** Like count. NULL when no match OR when likes are disabled on the video. */
  yt_like_count?: number | null;
  /** Comment count. NULL when no match OR when comments are disabled. */
  yt_comment_count?: number | null;
  /** Publication time of the matched YouTube video. */
  yt_video_published_at?: string | null;
  /**
   * When fetch-trends last refreshed the yt_* stats. UI uses this to show
   * "fetched Xh ago" so users can tell if numbers are stale.
   */
  yt_fetched_at?: string | null;
  /**
   * Tier 3 / Fix #5 — velocity signal derived from yt_view_count divided
   * by hours since the matched video was uploaded. NULL when:
   *   • either yt_view_count or yt_video_published_at is missing,
   *   • the matched video is < 3h old (sample too thin to claim a rate).
   *
   * UI MUST hide the badge when null — claiming "slow" with no data would
   * be a fabrication. The `tier` is a UI hint (racing / strong / steady /
   * slow), but `views` and `hours_since_publish` are the contract: the
   * tooltip MUST show literal "X views in Yh since upload" past-tense —
   * never project forward ("will hit N views by tomorrow"). This is a
   * snapshot of the recent past, not a forecast.
   */
  yt_velocity?: YouTubeVelocity | null;
  /**
   * Tier 3 / Fix #6 — Linear projection of when this trend's virality_score
   * will cross the "no longer worth posting" threshold (default 30).
   *
   * NULL when ANY of these is true:
   *   • < 5 days span between earliest and latest observation,
   *   • < 3 observations after filtering null scores,
   *   • slope is flat or rising (no decay to forecast),
   *   • R² < 0.3 (linear fit too noisy to project),
   *   • projected horizon > 7 days from now (slope too flat to trust),
   *   • current_score already ≤ threshold (already decayed).
   *
   * UI MUST render NULL as "no forecast available", NEVER as "won't decay"
   * or "will last forever". A NULL forecast is an honest abstention from
   * a claim we don't have the data to make.
   *
   * Tooltip MUST show: method (linear regression), span used, observation
   * count, R². The forecast is an ESTIMATE, not a prediction — the badge
   * copy must use "approximately"/"around" language, never a precise time.
   */
  decay_forecast?: DecayForecast | null;
  /**
   * Tier 3 / Fix #4 — Story-arc context. NULL when this trend is a
   * singleton (no other candidate trend belongs to its news cycle).
   * When present, it means ≥1 OTHER candidate trend shares ≥2 significant
   * tokens with this one — same news cycle, different angle.
   *
   * UI MUST surface `shared_tokens` in the tooltip so users can verify
   * the merge ("oh, both 'Rodrigo' and 'tour' — yes, same arc"). Never
   * cluster opaquely — if the shared signal isn't explainable, we
   * shouldn't be making the claim.
   *
   * `alternates` lists the other trends in this arc, sorted by
   * virality_score desc. UI typically shows the rep's badge with a
   * tooltip listing alternates by name.
   */
  arc?: TrendArc | null;
  /**
   * Time-series observation history (Tier 3 / Fix #1). Up to 14 most
   * recent observations, sorted ASCENDING by observed_at. UI MUST hide
   * the sparkline when length < 2 — a single point is not a "timeline".
   * UI MUST NOT extrapolate beyond the latest observation.
   */
  observation_history?: TrendObservation[];
  /**
   * Competitor coverage signal (Tier 3 / Fix #2). Tells us whether the
   * user's tracked competitors have already posted YouTube videos on
   * this trend, vs nobody on their watchlist has touched it yet.
   *
   * UI MUST honor the tri-state contract:
   *   • publishers === null  → couldn't check (no API key, search error).
   *     Render badge as ambiguous / hidden — never claim first-mover.
   *   • publishers === []    → checked cleanly, no recent YT videos at all.
   *     Real first-mover signal (qualified "on YouTube").
   *   • publishers.length >0, matches.length === 0 → first-mover signal still
   *     valid: tracked competitors haven't posted, even though others have.
   *   • matches.length > 0   → "X of N covering" badge.
   */
  competitor_coverage?: CompetitorCoverage;
  category?: TrendCategory | string;
}

// ── YouTube velocity (Tier 3 / Fix #5) ───────────────────────────────────────

/**
 * Tier of velocity for the matched YouTube video. Calibrated against
 * typical YouTube performance bands. UI uses this for the badge color +
 * label; the literal numbers (views, hours_since_publish) drive the
 * tooltip and remain the source of truth.
 */
export type YouTubeVelocityTier = 'racing' | 'strong' | 'steady' | 'slow';

export interface YouTubeVelocity {
  tier: YouTubeVelocityTier;
  /** Total view count at last fetch. */
  views: number;
  /** Hours between video publication and now (rounded to 1 decimal). */
  hours_since_publish: number;
  /** Convenience: views / hours_since_publish, rounded to whole numbers. */
  views_per_hour: number;
}

// ── Story arc (Tier 3 / Fix #4) ──────────────────────────────────────────────

/** One alternate trend in the same story arc as the chosen rec. */
export interface TrendArcAlternate {
  trend_id: string;
  trend_name: string;
  virality_score: number | null;
}

/**
 * Story-arc context for a clustered trend. See buildArcs() in
 * recommend-trends/index.ts for the cluster algorithm. The contract:
 * trends in the same arc share ≥2 significant tokens (length ≥4,
 * stopwords stripped) — the literal `shared_tokens` field exposes
 * those words so the UI can render an explainable merge.
 */
export interface TrendArc {
  /** Stable identifier for this cluster (derived from the rep's trend_id). */
  arc_id: string;
  /** Total trends in this cluster (always ≥ 2 — singletons get no arc). */
  cluster_size: number;
  /** True iff this trend is the highest-virality rep of its cluster. */
  is_arc_rep: boolean;
  /** trend_id of the rep (the arc's "headline" trend). */
  rep_trend_id: string;
  /**
   * Significant tokens shared across EVERY member of the cluster. UI
   * MUST surface these in the tooltip so the merge is verifiable.
   */
  shared_tokens: string[];
  /**
   * Other trends in this arc, sorted by virality_score desc. Excludes
   * the trend this `arc` is attached to.
   */
  alternates: TrendArcAlternate[];
}

// ── Decay forecast (Tier 3 / Fix #6) ─────────────────────────────────────────

/**
 * Linear projection of when a trend's virality_score will drop below the
 * "no longer worth posting" threshold. See computeDecayForecast in
 * recommend-trends/index.ts for the abstention rules. Every field is the
 * literal output of a transparent linear regression — UI MUST surface
 * `r_squared`, `observation_count`, and `history_span_days` in the tooltip
 * so users can verify the math themselves.
 */
export interface DecayForecast {
  /** ISO timestamp when virality_score is projected to cross threshold. */
  est_decays_below_at: string;
  /** The score threshold (default 30). Below this we treat the trend as weak. */
  decay_threshold: number;
  /** Most recent observed virality_score. */
  current_score: number;
  /** Linear slope in score/day. ALWAYS negative (we abstain when flat or rising). */
  slope_per_day: number;
  /** Span between earliest and latest observation, in days. */
  history_span_days: number;
  /** How many observations we fit on (after filtering nulls). */
  observation_count: number;
  /** Quality of fit, 0..1. We abstain below 0.3. */
  r_squared: number;
}

// ── Competitor coverage (Tier 3 / Fix #2) ────────────────────────────────────

/** One distinct YouTube channel that posted a recent video on a trend. */
export interface YouTubePublisher {
  channel_id: string;
  channel_title: string;
  video_id: string;
  video_title: string;
  published_at: string;
}

export interface CompetitorMatch {
  competitor_name: string;
  publisher: YouTubePublisher;
}

export interface CompetitorCoverage {
  /** Always 'YouTube' today. Future expansion (TikTok/IG) gets new values. */
  checked_platform: 'YouTube';
  /**
   * The publisher list we checked. NULL = "couldn't check" (no API key,
   * search error). Empty array = checked cleanly, zero items.
   */
  publishers: YouTubePublisher[] | null;
  /** Tracked competitors we matched in the publisher list. Possibly empty. */
  matches: CompetitorMatch[];
  /**
   * Tracked competitors we LOOKED FOR but didn't find. Surfaced in the
   * tooltip so the user can see which competitors we actually checked.
   */
  unmatched_competitors: string[];
}

/**
 * One snapshot of a trend's signal state at a moment in time. Powers the
 * sparkline component. NULL fields are honest — never zero-fill.
 */
export interface TrendObservation {
  observed_at: string;
  virality_score: number | null;
  corroboration_score: number | null;
  timing: string | null;
  ig_validated: string | null;
  yt_view_count: number | null;
  yt_like_count: number | null;
  yt_comment_count: number | null;
}

export interface RecommendedTrend extends Trend {
  why_good_fit: string;
  example_hook: string;
  angle_summary: string;
}

// ── Twitter / Social Pulse types ─────────────────────────────────────────────

export type TweetVelocity = 'rising' | 'stable' | 'fading';
export type TrendConfidence = 'high' | 'medium' | 'low';

export interface TwitterTrend {
  rank: number;
  name: string;
  category: string;
  velocity: TweetVelocity;
  freshness_hours: number;
  why_trending: string;
  confidence: TrendConfidence;
  marketer_signal: string | null;
}

export interface TwitterTrendsResponse {
  fetched_at: string;
  region: string;
  platform: 'Twitter';
  top_insight: string;
  accuracy_notes?: string;
  trends: TwitterTrend[];
  raw_count?: number;
}

export interface GeneratedTweet {
  draft_id: number;
  angle: string;
  text: string;
  char_count: number;
  hashtags: string[];
  over_limit?: boolean;
  // Populated when the draft was persisted to tweet_drafts during generation.
  // Lets the UI favorite/delete without re-fetching.
  id?: string | null;
}

// Persisted draft row (mirrors public.tweet_drafts).
export interface SavedTweetDraft {
  id: string;
  user_id: string;
  brand_id: string | null;
  brand_name: string | null;
  generation_id: string;
  trend_name: string;
  trend_category: string | null;
  trend_metadata: TwitterTrend | null;
  region: string | null;
  topic_angle: string | null;
  draft_id: number;
  angle: string | null;
  tweet_text: string;
  char_count: number;
  char_limit: number;
  hashtags: string[];
  over_limit: boolean;
  live_context_source: 'live' | 'stale' | 'none' | null;
  live_context_preview: string | null;
  is_favorite: boolean;
  posted_at: string | null;
  created_at: string;
}

// A "generation" = the 3 drafts produced by one Generate Tweets click.
export interface DraftGeneration {
  generation_id: string;
  trend_name: string;
  trend_category: string | null;
  region: string | null;
  brand_name: string | null;
  topic_angle: string | null;
  live_context_source: 'live' | 'stale' | 'none' | null;
  live_context_preview: string | null;
  created_at: string;
  drafts: SavedTweetDraft[];
}

// ── Creative directions & blueprint ──────────────────────────────────────────

export interface CreativeDirection {
  idea_id: number;
  title: string;
  summary: string;
  hook: string;
  visual_idea: string;
  suggested_cta: string;
}

export interface DetailedDirection {
  concept: string;
  script_outline: string[];
  full_script?: string | null;
  /** Cinematic-grade visual brief used when content_format is image / carousel / static. */
  visual_brief?: string | null;
  caption: string;
  long_caption?: string | null;
  recommended_hashtags: string[];
  extra_tips: string[];
}
