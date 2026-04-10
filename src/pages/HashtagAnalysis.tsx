import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
  Sparkles, ArrowRight, Eye, Bookmark, Share2, UserPlus, BarChart2,
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
  alternatives: Array<{ tag: string; type: "safer" | "niche"; reason: string }>;
}

interface DistributionReadiness {
  topic_clarity: string;
  audience_precision: number;
  saturation_exposure: "Low" | "Moderate" | "High";
  intent_coherence: "Matched" | "Mixed" | "Fragmented";
}

interface HashtagResult {
  request_id?: string;
  set_score: number;
  confidence_level: "high" | "moderate" | "experimental";
  distribution_readiness: DistributionReadiness;
  hashtags: HashtagItem[];
  why_this_works: string;
  best_posting_time: string;
  caption_keywords: string[];
  warnings: string[];
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
  "Building your optimal mix",
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const ScoreRing = ({ score, size = 88 }: { score: number; size?: number }) => {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-xl font-bold text-foreground">{score}</span>
    </div>
  );
};

const SubscoreBar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">{value}</span>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const HashtagAnalysis = () => {
  const { user }   = useAuth();
  const location   = useLocation();

  const [view,        setView]        = useState<"input" | "loading" | "results">("input");
  const [loadingStep, setLoadingStep] = useState(0);
  const [platform,    setPlatform]    = useState("instagram");
  const [region,      setRegion]      = useState("global");
  const [goal,        setGoal]        = useState("reach");
  const [caption,     setCaption]     = useState("");
  const [result,      setResult]      = useState<HashtagResult | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

  // Performance feedback
  const [feedbackState, setFeedbackState] = useState<"idle" | "open" | "submitting" | "submitted">("idle");
  const [perfViews,   setPerfViews]   = useState("");
  const [perfSaves,   setPerfSaves]   = useState("");
  const [perfShares,  setPerfShares]  = useState("");
  const [perfFollows, setPerfFollows] = useState("");

  // Trend Quest pre-fill via router state
  const tqState        = location.state as Record<string, unknown> | null;
  const fromTrendQuest = tqState?.fromTrendQuest === true;

  useEffect(() => {
    if (!fromTrendQuest || !tqState) return;
    if (typeof tqState.caption === "string") setCaption(tqState.caption);

    const bp = tqState.brand_profile as Record<string, string> | undefined;
    if (bp?.geography) {
      const key = bp.geography.toLowerCase();
      const match = Object.entries(GEO_MAP).find(([phrase]) => key.includes(phrase));
      if (match) setRegion(match[1]);
    }
    if (bp?.primary_goal) {
      const mapped = GOAL_MAP[bp.primary_goal.toLowerCase()];
      if (mapped) setGoal(mapped);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = async () => {
    if (!caption.trim()) { toast.error("Add your post idea or caption to analyze"); return; }

    setView("loading");
    setLoadingStep(0);
    setExpandedTag(null);

    // Step timings while API call runs
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
        setResult(data as HashtagResult);
        setView("results");
      }, 350);
    } catch (err) {
      handles.forEach(clearTimeout);
      console.error("Hashtag analysis error:", err);
      toast.error("Analysis failed. Please try again.");
      setView("input");
    }
  };

  const handleCopyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.hashtags.map((h) => h.tag).join(" "));
    setCopied(true);
    toast.success("Hashtags copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setView("input"); setResult(null); setExpandedTag(null);
    setFeedbackState("idle");
    setPerfViews(""); setPerfSaves(""); setPerfShares(""); setPerfFollows("");
  };

  const submitFeedback = async () => {
    if (!result?.request_id) {
      toast.error("Sign in to track performance");
      return;
    }
    const hasAnyValue = perfViews || perfSaves || perfShares || perfFollows;
    if (!hasAnyValue) {
      toast.error("Add at least one metric to log");
      return;
    }
    setFeedbackState("submitting");
    try {
      const { error } = await supabase.from("hashtag_outcomes").insert({
        request_id:    result.request_id,
        user_id:       user?.id ?? null,
        views:         perfViews   ? parseInt(perfViews,   10) : null,
        saves:         perfSaves   ? parseInt(perfSaves,   10) : null,
        shares:        perfShares  ? parseInt(perfShares,  10) : null,
        follows_gained: perfFollows ? parseInt(perfFollows, 10) : null,
        posted_at:     new Date().toISOString(),
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

          <div className="text-center space-y-2">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
              <Hash className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Hashtag Intelligence</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Not a generator — a strategy engine that tells you exactly which hashtags to use and why.
            </p>
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

            {/* Platform selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Platform
              </label>
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
                    <span>{p.emoji}</span>
                    {p.label}
                    {!p.available && <span className="text-[10px] opacity-50 ml-0.5">soon</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Post Idea or Caption
              </label>
              <Textarea
                placeholder="Paste your caption, describe what you're posting, or drop your full post idea here..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[128px] resize-none text-sm bg-secondary/50 border-border focus:border-primary/50"
              />
            </div>

            {/* Region + Goal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Region</label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="bg-secondary/50 border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Goal</label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="bg-secondary/50 border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOALS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={runAnalysis}
              disabled={!caption.trim()}
              className="w-full gap-2 font-medium"
              size="lg"
            >
              <Zap className="w-4 h-4" />
              Analyze Distribution
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Optimized for Instagram 2026 algorithm · Scores every hashtag across 10 dimensions
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
            <p className="text-sm text-muted-foreground">Running the intelligence engine</p>
          </div>

          <div className="space-y-3.5">
            {ANALYSIS_STEPS.map((step, i) => {
              const done   = i < loadingStep;
              const active = i === loadingStep;
              return (
                <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${done || active ? "opacity-100" : "opacity-25"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    done   ? "bg-primary text-primary-foreground"
                    : active ? "bg-primary/20 border border-primary/60"
                    : "bg-secondary border border-border"
                  }`}>
                    {done   && <Check className="w-3 h-3" />}
                    {active && <div className="w-2 h-2 rounded-full bg-primary loading-pulse" />}
                  </div>
                  <span className={`text-sm ${done || active ? "text-foreground" : "text-muted-foreground"}`}>
                    {step}
                  </span>
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 lg:p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              New analysis
            </button>
            <div className="flex items-center gap-2">
              {fromTrendQuest && tqState?.idea_title && (
                <span className="hidden sm:block text-xs text-muted-foreground max-w-[200px] truncate">
                  {tqState.idea_title as string}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-1.5 text-xs h-8">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy all"}
              </Button>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[288px_1fr] gap-4 items-start">

            {/* LEFT: Score + readiness panel */}
            <div className="space-y-3">

              <div className="post-card p-5 text-center space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distribution Strength</p>
                <ScoreRing score={result.set_score} />
                <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${CONFIDENCE_STYLES[result.confidence_level]}`}>
                  {result.confidence_level === "high"
                    ? "High Confidence"
                    : result.confidence_level === "moderate"
                      ? "Moderate Confidence"
                      : "Experimental"}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {result.set_score >= 80
                    ? "Well-positioned for niche discovery on this platform."
                    : result.set_score >= 65
                      ? "Good coverage with room to sharpen the angle."
                      : "Consider refining the content angle for stronger signals."}
                </p>
              </div>

              <div className="post-card p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distribution Readiness</p>
                <div className="flex items-start gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-secondary-foreground leading-relaxed">
                    {result.distribution_readiness.topic_clarity}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Audience precision</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className={`w-1.5 h-4 rounded-sm transition-colors ${
                        i <= result.distribution_readiness.audience_precision ? "bg-primary" : "bg-secondary"
                      }`} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Saturation risk</span>
                  <span className={`font-medium ${SATURATION_COLOR[result.distribution_readiness.saturation_exposure]}`}>
                    {result.distribution_readiness.saturation_exposure}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Intent coherence</span>
                  <span className={`font-medium ${COHERENCE_COLOR[result.distribution_readiness.intent_coherence]}`}>
                    {result.distribution_readiness.intent_coherence}
                  </span>
                </div>
              </div>

              {result.caption_keywords.length > 0 && (
                <div className="post-card p-4 space-y-2.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Caption Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.caption_keywords.map((kw) => (
                      <span key={kw} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Include in your caption to reinforce hashtag signals.</p>
                </div>
              )}

              {result.best_posting_time && (
                <div className="post-card p-4 flex items-start gap-3">
                  <Clock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Best Time to Post</p>
                    <p className="text-sm text-foreground leading-snug">{result.best_posting_time}</p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Hashtag cards + strategy */}
            <div className="space-y-3">
              {result.hashtags.map((item, i) => (
                <div
                  key={item.tag}
                  className="post-card overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
                    onClick={() => setExpandedTag(expandedTag === item.tag ? null : item.tag)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-base font-semibold text-foreground">{item.tag}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium leading-none ${
                            ROLE_STYLES[item.role] ?? "bg-secondary text-muted-foreground border border-border"
                          }`}>
                            {item.role}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug">{item.explanation}</p>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-xl font-bold text-foreground tabular-nums">{item.score}</div>
                          <div className="text-[10px] text-muted-foreground">score</div>
                        </div>
                        {expandedTag === item.tag
                          ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </div>

                  {expandedTag === item.tag && (
                    <div className="border-t border-border p-4 bg-secondary/20 space-y-5 animate-fade-in">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Score Breakdown</p>
                        <div className="space-y-2.5">
                          <SubscoreBar label="Relevance"              value={item.subscores.relevance} />
                          <SubscoreBar label="Audience Match"         value={item.subscores.audience_match} />
                          <SubscoreBar label="Trend Velocity"         value={item.subscores.trend_velocity} />
                          <SubscoreBar label="Competition Efficiency" value={item.subscores.competition_efficiency} />
                          <SubscoreBar label="Platform Fit"           value={item.subscores.platform_fit} />
                        </div>
                      </div>

                      {item.alternatives.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Alternatives</p>
                          <div className="space-y-2">
                            {item.alternatives.map((alt) => (
                              <div key={alt.tag} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/60">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-foreground">{alt.tag}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                      alt.type === "safer"
                                        ? "bg-blue-500/15 text-blue-400"
                                        : "bg-emerald-500/15 text-emerald-400"
                                    }`}>
                                      {alt.type}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{alt.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="post-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Why This Mix Works</p>
                </div>
                <p className="text-sm text-secondary-foreground leading-relaxed">{result.why_this_works}</p>
              </div>

              {result.warnings.length > 0 && (
                <div className="post-card p-4 border-amber-500/25 bg-amber-500/5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Heads Up</p>
                      <ul className="space-y-1">
                        {result.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-secondary-foreground">{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Performance feedback card ─────────────────────── */}
              {feedbackState === "idle" && (
                <div className="post-card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BarChart2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Posted with these hashtags?</p>
                      <p className="text-xs text-muted-foreground">Log your results — every data point makes future recs smarter.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFeedbackState("open")}
                    className="flex-shrink-0 text-xs gap-1.5"
                  >
                    Log Results
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {feedbackState === "open" && (
                <div className="post-card p-5 space-y-4 animate-fade-in">
                  <div>
                    <p className="text-sm font-semibold text-foreground">How did this post perform?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All fields optional — add whatever you have.</p>
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
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={value}
                          onChange={(e) => set(e.target.value)}
                          className="bg-secondary/50 border-border text-sm h-9"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={submitFeedback}
                      disabled={feedbackState === "submitting"}
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Results
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFeedbackState("idle")}
                      className="text-xs text-muted-foreground"
                    >
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
                      <p className="text-xs text-muted-foreground mt-2">
                        The system will factor this into your future recommendations.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashtagAnalysis;
