export interface Competitor {
  name: string;
  domain: string;
  type: 'local' | 'national' | 'global' | 'manual';
  why_relevant: string;
  is_aspirational: boolean;
}

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
  | 'Lifestyle';

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
