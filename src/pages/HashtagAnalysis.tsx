import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Hash, ArrowLeft, Copy, Check, Zap, BookOpen,
  ChevronDown, ChevronUp, AlertTriangle, Clock,
  Sparkles, ArrowRight, Eye, Bookmark, BookmarkPlus, Share2, UserPlus, BarChart2,
  Shield, FlaskConical, History, Instagram, RefreshCw, Link2, Brain, Unlink,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HashtagItem {
  tag: string;
  score: number;
  role: string;
  explanation: string;
  subscores: {
    relevance: number;
    audience_match: number;
    trend_velocity: number;
    competition_efficiency: number;
    platform_fit: number;
  };
}

interface DistributionReadiness {
  topic_clarity: string;
  audience_precision: number;
  saturation_exposure: "Low" | "Moderate" | "High";
  intent_coherence: "Matched" | "Mixed" | "Fragmented";
}

interface HashtagSet {
  set_type: "safe" | "experimental";
  set_label: string;
  set_description: string;
  set_score: number;
  confidence_level: "high" | "moderate" | "experimental";
  distribution_readiness: DistributionReadiness;
  hashtags: HashtagItem[];
  why_this_works: string;
  best_posting_time: string;
  caption_keywords: string[];
  warnings: string[];
}

interface PositioningMismatch {
  hashtag: string;
  present_in: "safe" | "experimental" | "both";
  conflict: string;
  severity: "high" | "medium" | "low";
  fix: string;
}

interface ContentPositioning {
  hook_tone: string;
  detected_content_intent: string;
  positioning_score: number;
  overall_verdict: "aligned" | "minor_drift" | "significant_mismatch";
  mismatches: PositioningMismatch[];
  recommendation: string;
  caption_tone_tips: string[];
}

interface AnalysisResult {
  request_id?: string;
  safe: HashtagSet;
  experimental: HashtagSet;
  positioning?: ContentPositioning;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "instagram", label: "Instagram", emoji: "📸", available: true  },
  { id: "tiktok",    label: "TikTok",    emoji: "🎵", available: false },
  { id: "youtube",   label: "YouTube",   emoji: "▶️", available: false },
];

const REGIONS = [
  { value: "global", label: "Global"         },
  { value: "US",     label: "United States"  },
  { value: "UK",     label: "United Kingdom" },
  { value: "IN",     label: "India"          },
  { value: "AU",     label: "Australia"      },
  { value: "CA",     label: "Canada"         },
  { value: "UAE",    label: "UAE"            },
  { value: "SG",     label: "Singapore"      },
  { value: "DE",     label: "Germany"        },
  { value: "BR",     label: "Brazil"         },
];

const GOALS = [
  { value: "reach",      label: "Reach & Discovery" },
  { value: "engagement", label: "Engagement"        },
  { value: "followers",  label: "Grow Followers"    },
  { value: "sales",      label: "Drive Sales"       },
  { value: "community",  label: "Build Community"   },
];

const ANALYSIS_STEPS = [
  "Reading content context",
  "Identifying audience signals",
  "Scanning hashtag clusters",
  "Evaluating trend & platform fit",
  "Building Safe + Experimental sets",
];

const ROLE_STYLES: Record<string, string> = {
  "Category Anchor": "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  "Audience Signal":  "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  "Niche Discovery":  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "Trend Expansion":  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "Geo Relevance":    "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
  "Buyer Intent":     "bg-pink-500/15 text-pink-400 border border-pink-500/30",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:         "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  moderate:     "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  experimental: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
};

const SATURATION_COLOR: Record<string, string> = {
  Low:      "text-emerald-400",
  Moderate: "text-amber-400",
  High:     "text-red-400",
};

const COHERENCE_COLOR: Record<string, string> = {
  Matched:    "text-emerald-400",
  Mixed:      "text-amber-400",
  Fragmented: "text-red-400",
};

const GEO_MAP: Record<string, string> = {
  "united kingdom": "UK", "uk": "UK",
  "united states": "US", "usa": "US",
  "india": "IN", "australia": "AU",
  "canada": "CA", "uae": "UAE", "dubai": "UAE",
  "singapore": "SG", "germany": "DE", "brazil": "BR",
};

const GOAL_MAP: Record<string, string> = {
  followers: "followers", engagement: "engagement",
  leads: "reach", sales: "sales", community: "community",
  "brand awareness": "reach", reach: "reach",
  "app downloads": "reach", traffic: "reach",
};

// ─── Forecast computation ─────────────────────────────────────────────────────

interface ForecastDimension {
  key:          string;
  label:        string;
  score:        number;        // 0–100 normalised
  value_label:  string;
  tip:          string;        // one-line context shown below the bar
  variant:      "green" | "amber" | "red";
}

interface ForecastData {
  dimensions:     ForecastDimension[];
  overall_score:  number;
  summary:        string;
  confidence_note: string;
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function clamp(n: number) { return Math.min(100, Math.max(0, Math.round(n))); }

function computeForecast(set: HashtagSet, positioning?: ContentPositioning): ForecastData {
  const dr      = set.distribution_readiness;
  const tags    = set.hashtags;
  const confMul = set.confidence_level === "high" ? 1.0 : set.confidence_level === "moderate" ? 0.87 : 0.72;

  // ── 1. Expected Reach ──────────────────────────────────────────────────────
  const satBonus =
    dr.saturation_exposure === "Low"      ?  12 :
    dr.saturation_exposure === "Moderate" ?   0 : -18;
  const avgTrend = avg(tags.map(t => t.subscores.trend_velocity));
  const trendBonus = avgTrend > 68 ? 8 : avgTrend < 38 ? -6 : 0;
  const reachRaw   = clamp((set.set_score + satBonus + trendBonus) * confMul);
  const reachLabel =
    reachRaw >= 78 ? "High" :
    reachRaw >= 58 ? "Moderate" :
    reachRaw >= 38 ? "Lower" : "Limited";
  const reachVariant: ForecastDimension["variant"] =
    reachRaw >= 70 ? "green" : reachRaw >= 50 ? "amber" : "red";

  // ── 2. Audience Precision ─────────────────────────────────────────────────
  const precBase     = (dr.audience_precision / 5) * 100;
  const cohBonus     =
    dr.intent_coherence === "Matched"    ?  10 :
    dr.intent_coherence === "Fragmented" ? -16 : 0;
  const avgAudMatch  = avg(tags.map(t => t.subscores.audience_match));
  const precRaw      = clamp(precBase * 0.35 + avgAudMatch * 0.65 + cohBonus);
  const precLabel    =
    precRaw >= 78 ? "Strong" :
    precRaw >= 58 ? "Moderate" :
    precRaw >= 38 ? "Broad" : "Weak";
  const precVariant: ForecastDimension["variant"] =
    precRaw >= 70 ? "green" : precRaw >= 50 ? "amber" : "red";

  // ── 3. Saturation Risk (higher score = lower risk = better) ───────────────
  const satBase  =
    dr.saturation_exposure === "Low"      ? 88 :
    dr.saturation_exposure === "Moderate" ? 58 : 28;
  const avgComp  = avg(tags.map(t => t.subscores.competition_efficiency));
  const satRaw   = clamp(satBase * 0.55 + avgComp * 0.45);
  const satLabel =
    satRaw >= 72 ? "Low" :
    satRaw >= 48 ? "Moderate" : "High";
  const satVariant: ForecastDimension["variant"] =
    satRaw >= 68 ? "green" : satRaw >= 46 ? "amber" : "red";

  // ── 4. Positioning alignment ──────────────────────────────────────────────
  const posRaw   = positioning ? positioning.positioning_score : clamp(set.set_score * 0.9);
  const posLabel =
    posRaw >= 82 ? "Aligned" :
    posRaw >= 62 ? "Minor Drift" : "Misaligned";
  const posVariant: ForecastDimension["variant"] =
    posRaw >= 75 ? "green" : posRaw >= 55 ? "amber" : "red";

  const dimensions: ForecastDimension[] = [
    {
      key:         "reach",
      label:       "Reach Potential",
      score:       reachRaw,
      value_label: reachLabel,
      tip:
        dr.saturation_exposure === "Low"
          ? "Low saturation — clear runway to rank in this tag cluster."
          : dr.saturation_exposure === "High"
          ? "High saturation — strong content quality is the deciding factor here."
          : "Moderate competition — good discoverability with the right hook.",
      variant:     reachVariant,
    },
    {
      key:         "precision",
      label:       "Audience Fit",
      score:       precRaw,
      value_label: precLabel,
      tip:
        precRaw >= 70
          ? "These tags draw the right viewer — not just any viewer."
          : precRaw >= 48
          ? "Some audience dilution — the signal cluster isn't fully tight."
          : "Broad audience signal — tighter niche tags would sharpen this.",
      variant:     precVariant,
    },
    {
      key:         "saturation",
      label:       "Competition Window",
      score:       satRaw,
      value_label: satLabel,
      tip:
        satRaw >= 68
          ? "Healthy discovery windows — low risk of getting buried."
          : satRaw >= 46
          ? "Some tags are contested — content quality will determine ranking."
          : "High competition — this cluster is crowded right now.",
      variant:     satVariant,
    },
    {
      key:         "positioning",
      label:       "Content Alignment",
      score:       posRaw,
      value_label: posLabel,
      tip:
        posRaw >= 75
          ? "Hook tone and hashtag intent reinforce the same signal."
          : posRaw >= 55
          ? "Minor semantic drift — Instagram's classifier may add noise."
          : "Alignment gap — review the Positioning analysis below.",
      variant:     posVariant,
    },
  ];

  const overall = clamp(
    reachRaw * 0.30 + precRaw * 0.25 + satRaw * 0.25 + posRaw * 0.20
  );

  const summary =
    overall >= 78
      ? "Ready to post — distribution signal is strong."
      : overall >= 60
      ? "Good to go. Small adjustments could push this further."
      : overall >= 45
      ? "Review before posting — mixed signals detected."
      : "Not ready — address the flagged issues below first.";

  const confidence_note =
    set.confidence_level === "high"
      ? "High model confidence on this set."
      : set.confidence_level === "moderate"
      ? "Moderate confidence — limited reference data for this niche."
      : "Experimental set — lower certainty, higher reach upside.";

  return { dimensions, overall_score: overall, summary, confidence_note };
}

// ─── ForecastPanel ────────────────────────────────────────────────────────────

const VARIANT_BAR: Record<ForecastDimension["variant"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red:   "bg-red-500",
};

const VARIANT_LABEL: Record<ForecastDimension["variant"], string> = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red:   "text-red-400",
};

const ForecastPanel = ({
  set,
  isSafe,
  positioning,
  isChosen,
}: {
  set:          HashtagSet;
  isSafe:       boolean;
  positioning?: ContentPositioning;
  isChosen:     boolean;
}) => {
  const forecast  = computeForecast(set, positioning);
  const score     = forecast.overall_score;
  const ringColor =
    score >= 75 ? "#10b981" :   // emerald-500
    score >= 55 ? "#f59e0b" :   // amber-400
    "#ef4444";                   // red-500
  const scoreLabel =
    score >= 78 ? "Ready to post" :
    score >= 60 ? "Good to go" :
    score >= 45 ? "Needs review" : "Not ready";
  const scoreLabelColor =
    score >= 78 ? "text-emerald-400" :
    score >= 60 ? "text-amber-400"   : "text-red-400";
  const border   = isChosen
    ? isSafe ? "border-primary/40" : "border-orange-500/40"
    : "border-border";

  return (
    <div className={`post-card overflow-hidden border ${border} animate-fade-in`}>

      {/* ── Hero: score ring + readiness sentence ── */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-5">
        <ScoreRing score={score} size={80} color={ringColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Post Readiness Score
            </p>
            {isChosen && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                isSafe
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/30"
              }`}>
                {isSafe ? "Safe set" : "Exp. set"}
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-foreground leading-tight">
            Your post is{" "}
            <span className={scoreLabelColor}>{score}% ready</span>{" "}
            for distribution.
          </p>
          <p className={`text-xs font-medium mt-1 ${scoreLabelColor}`}>{scoreLabel}</p>
        </div>
      </div>

      {/* ── 4 dimension bars ── */}
      <div className="px-5 pb-4 space-y-3.5 border-t border-border/50 pt-4">
        {forecast.dimensions.map((dim) => (
          <div key={dim.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{dim.label}</span>
              <span className={`text-xs font-bold tabular-nums ${VARIANT_LABEL[dim.variant]}`}>
                {dim.value_label}
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${VARIANT_BAR[dim.variant]}`}
                style={{ width: `${dim.score}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">{dim.tip}</p>
          </div>
        ))}
      </div>

      {/* ── Summary footer ── */}
      <div className="px-5 py-3 border-t border-border/50 flex items-start gap-2.5 bg-secondary/10">
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary" />
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs font-medium text-foreground">{forecast.summary}</p>
          <p className="text-[11px] text-muted-foreground">{forecast.confidence_note}</p>
        </div>
      </div>

    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ScoreRing = ({ score, size = 72, color = "hsl(var(--primary))" }: { score: number; size?: number; color?: string }) => {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <span className="absolute text-base font-bold text-foreground">{score}</span>
    </div>
  );
};

const SubscoreBar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700 ease-out"
        style={{ width: `${value}%` }} />
    </div>
    <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">{value}</span>
  </div>
);

// ─── ContentPositioningPanel ─────────────────────────────────────────────────

const VERDICT_CONFIG = {
  aligned: {
    label: "Aligned",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    pill: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    ring: "hsl(142 71% 45%)",
  },
  minor_drift: {
    label: "Minor Drift",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    ring: "hsl(38 92% 50%)",
  },
  significant_mismatch: {
    label: "Mismatch Detected",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    pill: "bg-red-500/15 text-red-400 border border-red-500/30",
    ring: "hsl(0 72% 51%)",
  },
};

const SEVERITY_CONFIG = {
  high:   { label: "High",   style: "bg-red-500/15 text-red-400 border border-red-500/30",   bar: "border-l-red-400" },
  medium: { label: "Medium", style: "bg-amber-500/15 text-amber-400 border border-amber-500/30", bar: "border-l-amber-400" },
  low:    { label: "Low",    style: "bg-secondary text-muted-foreground border border-border",    bar: "border-l-border" },
};

const SET_PILL: Record<string, string> = {
  safe:         "bg-primary/10 text-primary",
  experimental: "bg-orange-500/10 text-orange-400",
  both:         "bg-secondary text-muted-foreground",
};

const ContentPositioningPanel = ({ positioning }: { positioning: ContentPositioning }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const verdict = VERDICT_CONFIG[positioning.overall_verdict];
  const hasMismatches = positioning.mismatches.length > 0;

  return (
    <div className={`post-card overflow-hidden border ${verdict.bg} animate-fade-in`}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">Content Positioning</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${verdict.pill}`}>
              {verdict.label}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {positioning.hook_tone} · {positioning.detected_content_intent}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
            {positioning.hook_tone} · {positioning.detected_content_intent}
          </p>
        </div>

        {/* Score ring */}
        <div className="flex-shrink-0 relative">
          <svg width={48} height={48} className="-rotate-90">
            <circle cx={24} cy={24} r={19} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
            <circle cx={24} cy={24} r={19} fill="none" stroke={verdict.ring} strokeWidth="3"
              strokeDasharray={2 * Math.PI * 19}
              strokeDashoffset={2 * Math.PI * 19 * (1 - positioning.positioning_score / 100)}
              strokeLinecap="round" className="transition-all duration-1000 ease-out" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
            {positioning.positioning_score}
          </span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="px-4 py-3 border-b border-border/50 bg-secondary/10">
        <p className="text-xs text-secondary-foreground leading-relaxed">{positioning.recommendation}</p>
      </div>

      {/* Mismatches */}
      {hasMismatches && (
        <div className="divide-y divide-border/50">
          {positioning.mismatches.map((m, i) => {
            const sev = SEVERITY_CONFIG[m.severity];
            const isOpen = expanded === i;
            return (
              <div key={i} className={`border-l-2 ${sev.bar}`}>
                <button
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/10 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-foreground">{m.hashtag}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${sev.style}`}>
                        {sev.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium leading-none ${SET_PILL[m.present_in]}`}>
                        {m.present_in === "both" ? "both sets" : m.present_in}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{m.conflict}</p>
                  </div>
                  <div className="flex-shrink-0 mt-0.5">
                    {isOpen
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-3 bg-secondary/15 animate-fade-in border-t border-border/30">
                    <div className="flex items-start gap-2 pt-2.5">
                      <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fix</p>
                        <p className="text-xs text-foreground leading-snug">{m.fix}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No mismatches — affirm */}
      {!hasMismatches && (
        <div className="px-4 py-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-400/80">
            No intent mismatches detected — your hashtags and content tone are pulling in the same direction.
          </p>
        </div>
      )}

      {/* Caption tone tips */}
      {positioning.caption_tone_tips.length > 0 && (
        <div className="px-4 py-3 border-t border-border/50 bg-secondary/5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Caption tone tips
          </p>
          <div className="flex flex-wrap gap-1.5">
            {positioning.caption_tone_tips.map((tip, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/50 text-secondary-foreground font-medium">
                {tip}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Weave these into your caption body to reinforce the intent signal for Instagram's NLP.
          </p>
        </div>
      )}

    </div>
  );
};

// ─── HashtagSetPanel ──────────────────────────────────────────────────────────

const HashtagSetPanel = ({
  set,
  isChosen,
  isSafe,
  expandedTag,
  onExpandTag,
  onChoose,
  onCopy,
  copiedSet,
  pinned,
  onPin,
}: {
  set: HashtagSet;
  isChosen: boolean;
  isSafe: boolean;
  expandedTag: string | null;
  onExpandTag: (tag: string | null) => void;
  onChoose: () => void;
  onCopy: () => void;
  copiedSet: boolean;
  pinned: Set<string>;
  onPin: (tag: string) => void;
}) => {
  const borderClass = isChosen
    ? isSafe
      ? "border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
      : "border-orange-500/60 shadow-[0_0_0_1px_hsl(24_100%_50%/0.3)]"
    : "border-border";

  const scoreColor = isSafe ? "hsl(var(--primary))" : "hsl(24 100% 55%)";

  return (
    <div className={`post-card overflow-hidden border transition-all duration-300 ${borderClass}`}>

      {/* Set header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-border ${
        isSafe ? "bg-primary/5" : "bg-orange-500/5"
      }`}>
        <div className="flex items-center gap-2.5">
          {isSafe
            ? <Shield className="w-4 h-4 text-primary" />
            : <FlaskConical className="w-4 h-4 text-orange-400" />
          }
          <div>
            <p className={`text-sm font-semibold ${isSafe ? "text-primary" : "text-orange-400"}`}>
              {set.set_label}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{set.set_description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ScoreRing score={set.set_score} size={52} color={scoreColor} />
        </div>
      </div>

      {/* Distribution readiness strip */}
      <div className="px-4 py-2.5 flex items-center gap-4 border-b border-border bg-secondary/20 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <BookOpen className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">{set.distribution_readiness.topic_clarity}</span>
        </div>
        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          <span className={`text-xs font-medium ${SATURATION_COLOR[set.distribution_readiness.saturation_exposure]}`}>
            {set.distribution_readiness.saturation_exposure} saturation
          </span>
          <span className={`text-xs font-medium ${COHERENCE_COLOR[set.distribution_readiness.intent_coherence]}`}>
            {set.distribution_readiness.intent_coherence}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[set.confidence_level]}`}>
            {set.confidence_level === "high" ? "High" : set.confidence_level === "moderate" ? "Moderate" : "Exp."}
          </span>
        </div>
      </div>

      {/* Hashtag cards */}
      <div className="divide-y divide-border">
        {set.hashtags.map((item, i) => (
          <div key={`${set.set_type}-${item.tag}`} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div
              className="px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
              onClick={() => onExpandTag(expandedTag === `${set.set_type}-${item.tag}` ? null : `${set.set_type}-${item.tag}`)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{item.tag}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${
                      ROLE_STYLES[item.role] ?? "bg-secondary text-muted-foreground border border-border"
                    }`}>{item.role}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{item.explanation}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-base font-bold text-foreground tabular-nums">{item.score}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPin(item.tag); }}
                    className={`p-0.5 rounded transition-colors ${
                      pinned.has(item.tag)
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={pinned.has(item.tag) ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    {pinned.has(item.tag)
                      ? <Bookmark className="w-3.5 h-3.5 fill-current" />
                      : <BookmarkPlus className="w-3.5 h-3.5" />
                    }
                  </button>
                  {expandedTag === `${set.set_type}-${item.tag}`
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </div>
              </div>
            </div>

            {expandedTag === `${set.set_type}-${item.tag}` && (
              <div className="px-4 pb-3 bg-secondary/20 space-y-2 animate-fade-in border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-3 mb-2">Score Breakdown</p>
                <SubscoreBar label="Relevance"              value={item.subscores.relevance} />
                <SubscoreBar label="Audience Match"         value={item.subscores.audience_match} />
                <SubscoreBar label="Trend Velocity"         value={item.subscores.trend_velocity} />
                <SubscoreBar label="Competition Efficiency" value={item.subscores.competition_efficiency} />
                <SubscoreBar label="Platform Fit"           value={item.subscores.platform_fit} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Why this works */}
      <div className="px-4 py-3 border-t border-border bg-secondary/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Why this works</p>
        </div>
        <p className="text-xs text-secondary-foreground leading-relaxed">{set.why_this_works}</p>
      </div>

      {/* Warnings */}
      {set.warnings.length > 0 && (
        <div className="px-4 py-2.5 border-t border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <ul className="space-y-0.5">
              {set.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300/80">{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2">
        {isChosen ? (
          <div className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
              isSafe ? "bg-primary/15 text-primary" : "bg-orange-500/15 text-orange-400"
            }`}>
              <Check className="w-3.5 h-3.5" />
              Using this set
            </div>
            <Button variant="ghost" size="sm" onClick={onCopy} className="gap-1.5 text-xs h-7 ml-auto">
              {copiedSet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedSet ? "Copied!" : "Copy"}
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onChoose}
              className={`flex-1 gap-1.5 text-xs h-8 ${
                isSafe
                  ? "border-primary/30 text-primary hover:bg-primary/10"
                  : "border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              }`}
            >
              I'm using this set
            </Button>
            <Button variant="ghost" size="sm" onClick={onCopy} className="gap-1.5 text-xs h-8">
              {copiedSet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedSet ? "Copied!" : "Copy"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const HashtagAnalysis = () => {
  const { user }   = useAuth();
  const location   = useLocation();
  const navigate   = useNavigate();

  const [view,        setView]        = useState<"input" | "loading" | "results">("input");
  const [loadingStep, setLoadingStep] = useState(0);
  const [platform,    setPlatform]    = useState("instagram");
  const [region,      setRegion]      = useState("global");
  const [goal,        setGoal]        = useState("reach");
  const [caption,     setCaption]     = useState("");

  const [result,      setResult]      = useState<AnalysisResult | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  // Which set the user chose — "safe" | "experimental" | null
  const [chosenSet,   setChosenSet]   = useState<"safe" | "experimental" | null>(null);
  const [copiedSafe,  setCopiedSafe]  = useState(false);
  const [copiedExp,   setCopiedExp]   = useState(false);

  // Performance feedback
  const [feedbackState, setFeedbackState] = useState<"idle" | "open" | "submitting" | "submitted">("idle");
  const [perfViews,   setPerfViews]   = useState("");
  const [perfSaves,   setPerfSaves]   = useState("");
  const [perfShares,  setPerfShares]  = useState("");
  const [perfFollows, setPerfFollows] = useState("");

  // Watchlist — pinned tag names for this user
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  // Instagram connection
  const [igConnection, setIgConnection] = useState<{ username: string; last_synced_at: string | null } | null>(null);
  const [igConnecting, setIgConnecting] = useState(false);
  const [igSyncing,    setIgSyncing]    = useState(false);

  const tqState        = location.state as Record<string, unknown> | null;
  const fromTrendQuest = tqState?.fromTrendQuest === true;

  useEffect(() => {
    if (!fromTrendQuest || !tqState) return;
    if (typeof tqState.caption === "string")   setCaption(tqState.caption);
    if (typeof tqState.platform === "string")  setPlatform(tqState.platform);
    if (typeof tqState.region === "string")    setRegion(tqState.region);
    if (typeof tqState.goal === "string")      setGoal(tqState.goal);
    const bp = tqState.brand_profile as Record<string, string> | undefined;
    if (bp?.geography) {
      const key   = bp.geography.toLowerCase();
      const match = Object.entries(GEO_MAP).find(([phrase]) => key.includes(phrase));
      if (match) setRegion(match[1]);
    }
    if (bp?.primary_goal) {
      const mapped = GOAL_MAP[bp.primary_goal.toLowerCase()];
      if (mapped) setGoal(mapped);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle re-analyze pre-fill from HashtagHistory page
  useEffect(() => {
    if (!tqState || fromTrendQuest) return;
    if (typeof tqState.prefillCaption === "string") setCaption(tqState.prefillCaption);
    if (typeof tqState.region         === "string") setRegion(tqState.region);
    if (typeof tqState.goal           === "string") setGoal(tqState.goal);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load pinned tags from watchlist
  useEffect(() => {
    if (!user) return;
    supabase
      .from("hashtag_watchlist")
      .select("tag")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setPinned(new Set(data.map((r: { tag: string }) => r.tag)));
      });
  }, [user]);

  // Check Instagram connection status
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("instagram-auth", {
      body: { action: "status", user_id: user.id },
    }).then(({ data }) => {
      if (data?.connected && data?.connection) {
        setIgConnection({ username: data.connection.username, last_synced_at: data.connection.last_synced_at });
      }
    }).catch(console.warn);
  }, [user]);

  const handlePin = async (tag: string, sourceSet: "safe" | "experimental") => {
    if (!user) return;
    const isPinned = pinned.has(tag);
    // Optimistic update
    setPinned((prev) => {
      const next = new Set(prev);
      if (isPinned) next.delete(tag); else next.add(tag);
      return next;
    });
    if (isPinned) {
      await supabase.from("hashtag_watchlist").delete().eq("user_id", user.id).eq("tag", tag);
      toast.success(`${tag} removed from watchlist`);
    } else {
      await supabase.from("hashtag_watchlist").upsert(
        {
          user_id:           user.id,
          tag,
          source_request_id: result?.request_id ?? null,
          source_set:        sourceSet,
        },
        { onConflict: "user_id,tag" }
      );
      toast.success(`${tag} added to watchlist`);
    }
  };

  const handleConnectInstagram = async () => {
    if (!user) { toast.error("Sign in to connect Instagram"); return; }
    setIgConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/instagram-callback`;
      const { data, error } = await supabase.functions.invoke("instagram-auth", {
        body: { action: "initiate", redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Instagram connection");
      setIgConnecting(false);
    }
  };

  const handleSyncInstagram = async () => {
    if (!user) return;
    setIgSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-sync", {
        body: { user_id: user.id, link_request_id: result?.request_id ?? null },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Synced ${data.synced} posts from Instagram${data.linked > 0 ? ` · ${data.linked} linked to this analysis` : ""}`);
      setIgConnection((c) => c ? { ...c, last_synced_at: new Date().toISOString() } : c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIgSyncing(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!user) return;
    if (!window.confirm("Disconnect Instagram? You can reconnect a different account at any time.")) return;
    try {
      const { data, error } = await supabase.functions.invoke("instagram-auth", {
        body: { action: "disconnect", user_id: user.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setIgConnection(null);
      toast.success("Instagram disconnected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

  const runAnalysis = async () => {
    if (!caption.trim()) { toast.error("Add your post idea or caption to analyze"); return; }
    setView("loading");
    setLoadingStep(0);
    setExpandedTag(null);
    setChosenSet(null);

    const handles = [600, 1500, 2600, 3700].map((ms, i) =>
      setTimeout(() => setLoadingStep(i + 1), ms)
    );

    try {
      const { data, error } = await supabase.functions.invoke("analyze-hashtags", {
        body: {
          caption:      caption.trim(),
          platform,
          region,
          goal_type:    goal,
          brand_profile: fromTrendQuest ? (tqState?.brand_profile ?? null) : null,
          from_trend_quest: fromTrendQuest
            ? {
                trend_id:       tqState?.trend_id,
                trend_name:     tqState?.trend_name,
                idea_title:     tqState?.idea_title,
                trend_hashtags: tqState?.trend_hashtags,
              }
            : null,
          user_id: user?.id ?? null,
        },
      });
      handles.forEach(clearTimeout);
      if (error) throw error;
      setLoadingStep(5);
      setTimeout(() => {
        setResult(data as AnalysisResult);
        setView("results");
      }, 350);
    } catch (err) {
      handles.forEach(clearTimeout);
      console.error("Hashtag analysis error:", err);
      toast.error("Analysis failed. Please try again.");
      setView("input");
    }
  };

  const handleChooseSet = (setType: "safe" | "experimental") => {
    setChosenSet(setType);
    setFeedbackState("idle");
    toast.success(`${setType === "safe" ? "Safe Reach" : "Experimental Reach"} set selected — good luck with the post!`);
  };

  const handleCopySet = (setType: "safe" | "experimental") => {
    if (!result) return;
    const tags = result[setType].hashtags.map((h) => h.tag).join(" ");
    navigator.clipboard.writeText(tags);
    if (setType === "safe") {
      setCopiedSafe(true);
      setTimeout(() => setCopiedSafe(false), 2000);
    } else {
      setCopiedExp(true);
      setTimeout(() => setCopiedExp(false), 2000);
    }
    toast.success("Hashtags copied!");
  };

  const handleReset = () => {
    setView("input"); setResult(null); setExpandedTag(null); setChosenSet(null);
    setFeedbackState("idle");
    setPerfViews(""); setPerfSaves(""); setPerfShares(""); setPerfFollows("");
  };

  const submitFeedback = async () => {
    if (!result?.request_id) { toast.error("Sign in to track performance"); return; }
    const hasAny = perfViews || perfSaves || perfShares || perfFollows;
    if (!hasAny) { toast.error("Add at least one metric to log"); return; }
    setFeedbackState("submitting");
    try {
      const { error } = await supabase.from("hashtag_outcomes").insert({
        request_id:     result.request_id,
        user_id:        user?.id ?? null,
        set_chosen:     chosenSet,
        views:          perfViews   ? parseInt(perfViews,   10) : null,
        saves:          perfSaves   ? parseInt(perfSaves,   10) : null,
        shares:         perfShares  ? parseInt(perfShares,  10) : null,
        follows_gained: perfFollows ? parseInt(perfFollows, 10) : null,
        posted_at:      new Date().toISOString(),
      });
      if (error) throw error;
      setFeedbackState("submitted");
      toast.success("Results logged — the system will learn from this.");
    } catch (err) {
      console.error("Feedback error:", err);
      toast.error("Couldn't save results. Try again.");
      setFeedbackState("open");
    }
  };

  // ── INPUT ──────────────────────────────────────────────────────────────────
  if (view === "input") {
    return (
      <div className="h-full flex items-start justify-center p-4 lg:p-6 pt-8 lg:pt-14 overflow-y-auto">
        <div className="w-full max-w-xl space-y-6">

          <div className="flex items-start justify-between">
            <div className="text-center flex-1 space-y-2">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <Hash className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Hashtag Intelligence</h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Returns two optimised sets — a Safe strategy and an Experimental one. Pick your bet.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => navigate("/hashtag-history")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>
              <button
                onClick={() => navigate("/creator-intelligence")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                Intelligence
              </button>
            </div>
          </div>

          {fromTrendQuest && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-primary/8 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-primary">Pre-filled from Trend Quest</span>
                {tqState?.idea_title && (
                  <span className="text-xs text-muted-foreground ml-1.5 truncate">
                    · {tqState.idea_title as string}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="post-card p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Platform</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    disabled={!p.available}
                    onClick={() => p.available && setPlatform(p.id)}
                    className={[
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      platform === p.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : p.available
                          ? "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                          : "bg-secondary/40 text-muted-foreground/50 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <span>{p.emoji}</span>{p.label}
                    {!p.available && <span className="text-[10px] opacity-50 ml-0.5">soon</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Post Idea or Caption</label>
              <Textarea
                placeholder="Paste your caption, describe what you're posting, or drop your full post idea here..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[128px] resize-none text-sm bg-secondary/50 border-border focus:border-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Region</label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Goal</label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={runAnalysis} disabled={!caption.trim()} className="w-full gap-2 font-medium" size="lg">
              <Zap className="w-4 h-4" />
              Analyze Distribution
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Returns Safe + Experimental sets · Instagram 2026 algorithm · 10-dimension scoring
          </p>
        </div>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-8">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto loading-pulse">
              <Hash className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Analyzing your content</h2>
            <p className="text-sm text-muted-foreground">Building Safe + Experimental sets</p>
          </div>
          <div className="space-y-3.5">
            {ANALYSIS_STEPS.map((step, i) => {
              const done   = i < loadingStep;
              const active = i === loadingStep;
              return (
                <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${done || active ? "opacity-100" : "opacity-25"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 border border-primary/60" : "bg-secondary border border-border"
                  }`}>
                    {done   && <Check className="w-3 h-3" />}
                    {active && <div className="w-2 h-2 rounded-full bg-primary loading-pulse" />}
                  </div>
                  <span className={`text-sm ${done || active ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (!result) return null;

  const activeSet = chosenSet ? result[chosenSet] : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <button onClick={handleReset} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              New analysis
            </button>
            <div className="flex items-center gap-3">
              {fromTrendQuest && tqState?.idea_title && (
                <span className="hidden sm:block text-xs text-muted-foreground max-w-[200px] truncate">
                  {tqState.idea_title as string}
                </span>
              )}
              <button
                onClick={() => navigate("/hashtag-history")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>
              <button
                onClick={() => navigate("/creator-intelligence")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                Intelligence
              </button>
            </div>
          </div>

          {/* Choose-your-set prompt — shown until a set is chosen */}
          {!chosenSet && (
            <div className="post-card p-4 flex items-center gap-3 border-primary/20 bg-primary/5 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Two sets ready — which are you using?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap "I'm using this set" on the one you post with. We'll track what works.
                </p>
              </div>
            </div>
          )}

          {/* Post Readiness Score — always visible from the moment results load */}
          <ForecastPanel
            set={chosenSet ? result[chosenSet] : result.safe}
            isSafe={chosenSet ? chosenSet === "safe" : true}
            positioning={result.positioning}
            isChosen={!!chosenSet}
          />

          {chosenSet && (
            <div className="post-card p-3.5 flex items-center gap-3 border-emerald-500/20 bg-emerald-500/5 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-400 font-medium">
                {chosenSet === "safe" ? "Safe Reach" : "Experimental Reach"} selected
                <span className="text-muted-foreground font-normal ml-1.5">— score updated to match.</span>
              </p>
            </div>
          )}

          {/* Shared signal strip (caption keywords + posting time from safe set) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.safe.caption_keywords.length > 0 && (
              <div className="post-card p-3.5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Caption Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.safe.caption_keywords.map((kw) => (
                    <span key={kw} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">{kw}</span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Include in your caption to reinforce the hashtag signals.</p>
              </div>
            )}
            {result.safe.best_posting_time && (
              <div className="post-card p-3.5 flex items-start gap-3">
                <Clock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Best Time to Post</p>
                  <p className="text-sm text-foreground leading-snug">{result.safe.best_posting_time}</p>
                </div>
              </div>
            )}
          </div>

          {/* A/B set panels side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <HashtagSetPanel
              set={result.safe}
              isChosen={chosenSet === "safe"}
              isSafe={true}
              expandedTag={expandedTag}
              onExpandTag={setExpandedTag}
              onChoose={() => handleChooseSet("safe")}
              onCopy={() => handleCopySet("safe")}
              copiedSet={copiedSafe}
              pinned={pinned}
              onPin={(tag) => handlePin(tag, "safe")}
            />
            <HashtagSetPanel
              set={result.experimental}
              isChosen={chosenSet === "experimental"}
              isSafe={false}
              expandedTag={expandedTag}
              onExpandTag={setExpandedTag}
              onChoose={() => handleChooseSet("experimental")}
              onCopy={() => handleCopySet("experimental")}
              copiedSet={copiedExp}
              pinned={pinned}
              onPin={(tag) => handlePin(tag, "experimental")}
            />
          </div>

          {/* Content Positioning analysis */}
          {result.positioning && (
            <ContentPositioningPanel positioning={result.positioning} />
          )}

          {/* Performance feedback — shown once a set is chosen */}
          {chosenSet && (
            <div className="animate-fade-in">
              {feedbackState === "idle" && (
                <div className="post-card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BarChart2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Posted? Log how it performed.</p>
                      <p className="text-xs text-muted-foreground">Helps the system learn what works for your content.</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFeedbackState("open")} className="flex-shrink-0 text-xs gap-1.5">
                    Log Results <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {feedbackState === "open" && (
                <div className="post-card p-5 space-y-4 animate-fade-in">
                  <div>
                    <p className="text-sm font-semibold text-foreground">How did this post perform?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Logging results for the <span className={`font-medium ${chosenSet === "safe" ? "text-primary" : "text-orange-400"}`}>
                        {chosenSet === "safe" ? "Safe Reach" : "Experimental Reach"}
                      </span> set. All fields optional.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Views",   icon: Eye,      value: perfViews,   set: setPerfViews   },
                      { label: "Saves",   icon: Bookmark, value: perfSaves,   set: setPerfSaves   },
                      { label: "Shares",  icon: Share2,   value: perfShares,  set: setPerfShares  },
                      { label: "Follows", icon: UserPlus, value: perfFollows, set: setPerfFollows },
                    ].map(({ label, icon: Icon, value, set }) => (
                      <div key={label}>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                          <Icon className="w-3.5 h-3.5" />{label}
                        </label>
                        <Input
                          type="number" min="0" placeholder="0" value={value}
                          onChange={(e) => set(e.target.value)}
                          className="bg-secondary/50 border-border text-sm h-9"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={submitFeedback} disabled={feedbackState === "submitting"} size="sm" className="gap-1.5 text-xs">
                      <Check className="w-3.5 h-3.5" /> Save Results
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setFeedbackState("idle")} className="text-xs text-muted-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {feedbackState === "submitted" && (
                <div className="post-card p-4 bg-emerald-500/5 border-emerald-500/20 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-400 mb-1.5">Results logged</p>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { label: "Views",   icon: Eye,      value: perfViews   },
                          { label: "Saves",   icon: Bookmark, value: perfSaves   },
                          { label: "Shares",  icon: Share2,   value: perfShares  },
                          { label: "Follows", icon: UserPlus, value: perfFollows },
                        ].filter(m => m.value).map(({ label, icon: Icon, value }) => (
                          <div key={label} className="flex items-center gap-1 text-xs text-secondary-foreground">
                            <Icon className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">{parseInt(value).toLocaleString()}</span>
                            <span className="text-muted-foreground">{label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">The system will factor this into your future recommendations.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instagram Connection panel */}
          <div className="post-card p-4 border-border animate-fade-in">
            {igConnection ? (
              /* Connected state */
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        @{igConnection.username}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {igConnection.last_synced_at
                        ? `Last synced ${new Date(igConnection.last_synced_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "Not synced yet"
                      }
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncInstagram}
                    disabled={igSyncing}
                    className="flex-shrink-0 gap-1.5 text-xs border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                  >
                    <RefreshCw className={`w-3 h-3 ${igSyncing ? "animate-spin" : ""}`} />
                    {igSyncing ? "Syncing..." : "Sync Now"}
                  </Button>
                </div>
                {/* Disconnect / reconnect row */}
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground flex-1">
                    Want to connect a different account?
                  </p>
                  <button
                    onClick={handleDisconnectInstagram}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Unlink className="w-3 h-3" />
                    Disconnect
                  </button>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <button
                    onClick={handleConnectInstagram}
                    disabled={igConnecting}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-pink-400 transition-colors"
                  >
                    <Link2 className="w-3 h-3" />
                    {igConnecting ? "Redirecting..." : "Reconnect"}
                  </button>
                </div>
              </div>
            ) : (
              /* Not connected state */
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Connect Instagram</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-pull real post performance instead of logging manually.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectInstagram}
                  disabled={igConnecting}
                  className="flex-shrink-0 gap-1.5 text-xs border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                >
                  <Link2 className="w-3 h-3" />
                  {igConnecting ? "Redirecting..." : "Connect"}
                </Button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default HashtagAnalysis;
