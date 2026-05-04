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
   * Time-series observation history (Tier 3 / Fix #1). Up to 14 most
   * recent observations, sorted ASCENDING by observed_at. UI MUST hide
   * the sparkline when length < 2 — a single point is not a "timeline".
   * UI MUST NOT extrapolate beyond the latest observation.
   */
  observation_history?: TrendObservation[];
  category?: TrendCategory | string;
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
