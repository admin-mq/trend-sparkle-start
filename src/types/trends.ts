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
}

export type TrendTiming = 'early' | 'peaking' | 'saturated';

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
  ig_confirmed?: boolean;
  virality_score?: number;
  source_signals?: string[];
  category?: TrendCategory | string;
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
  caption: string;
  recommended_hashtags: string[];
  extra_tips: string[];
}
