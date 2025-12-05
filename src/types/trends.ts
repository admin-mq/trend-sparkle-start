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
}

export interface Trend {
  trend_id: string;
  trend_name: string;
  views_last_60h_millions: number | null;
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
