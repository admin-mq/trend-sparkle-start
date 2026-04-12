import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Layers, Zap, Loader2, TrendingUp, Minus, X,
  Shield, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Sparkles, Hash, ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GapTag {
  tag: string;
  opportunity_score: number;
  risk: "low" | "medium" | "high";
  reason: string;
  verdict: "adopt" | "test" | "skip";
}

interface UserEdgeTag {
  tag: string;
  type: "differentiator" | "blind_spot" | "niche_specific";
  note: string;
}

interface GapResult {
  gaps: GapTag[];
  user_edge: UserEdgeTag[];
  common_ground: string[];
  overlap_strength: "strong" | "moderate" | "weak";
  strategy_summary: string;
  top_actions: string[];
}

interface PortfolioTag {
  tag: string;
  uses: number;
  avg_score: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const VERDICT_CONFIG = {
  adopt: {
    label:  "Adopt",
    pill:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    icon:   TrendingUp,
    bar:    "bg-emerald-500",
  },
  test: {
    label:  "Test",
    pill:   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    icon:   Minus,
    bar:    "bg-amber-400",
  },
  skip: {
    label:  "Skip",
    pill:   "bg-secondary text-muted-foreground border border-border",
    icon:   X,
    bar:    "bg-border",
  },
};

const EDGE_CONFIG = {
  differentiator: {
    label: "Differentiator",
    pill:  "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    icon:  Shield,
  },
  blind_spot: {
    label: "Blind Spot",
    pill:  "bg-red-500/15 text-red-400 border border-red-500/30",
    icon:  AlertTriangle,
  },
  niche_specific: {
    label: "Niche Focus",
    pill:  "bg-secondary text-muted-foreground border border-border",
    icon:  Hash,
  },
};

const RISK_COLOR = {
  low:    "text-emerald-400",
  medium: "text-amber-400",
  high:   "text-red-400",
};

const OVERLAP_CONFIG = {
  strong:   { label: "Strong Overlap",   color: "text-emerald-400", note: "Your strategy covers most of this niche's baseline." },
  moderate: { label: "Moderate Overlap", color: "text-amber-400",   note: "Some gaps worth filling — good room to grow." },
  weak:     { label: "Weak Overlap",     color: "text-red-400",     note: "Significant gaps — you're missing core niche coverage." },
};

const ANALYSIS_STEPS = [
  "Parsing competitor hashtags",
  "Loading your portfolio",
  "Mapping overlaps and gaps",
  "Scoring adoption opportunities",
  "Building strategic recommendations",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,\n\r;]+/)
        .map((t) => t.trim().toLowerCase().replace(/^#+/, ""))
        .filter(Boolean)
        .map((t) => `#${t}`)
    ),
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GapCard({ gap }: { gap: GapTag }) {
  const [open, setOpen] = useState(false);
  const cfg = VERDICT_CONFIG[gap.verdict];
  const VerdictIcon = cfg.icon;

  return (
    <div className="post-card overflow-hidden hover:border-primary/20 transition-colors">
      <button
        className="w-full text-left px-4 py-3 hover:bg-secondary/10 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-bold text-foreground">{gap.tag}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.pill}`}>
                <VerdictIcon className="w-3 h-3" />
                {cfg.label}
              </span>
              <span className={`text-[10px] font-medium ${RISK_COLOR[gap.risk]}`}>
                {gap.risk} risk
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug line-clamp-1">{gap.reason}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Opportunity score */}
            <div className="text-right hidden sm:block">
              <span className={`text-base font-bold tabular-nums ${
                gap.opportunity_score >= 70 ? "text-emerald-400" :
                gap.opportunity_score >= 45 ? "text-amber-400" : "text-muted-foreground"
              }`}>{gap.opportunity_score}</span>
            </div>
            {open
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-secondary/20 border-t border-border space-y-3 animate-fade-in">
          {/* Score bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Opportunity Score</span>
              <span className="font-bold text-foreground tabular-nums">{gap.opportunity_score}/100</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                style={{ width: `${gap.opportunity_score}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{gap.reason}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "gaps" | "user_edge" | "common";

const HashtagGapAnalysis = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  // Input state
  const [competitorInput, setCompetitorInput] = useState("");
  const [nicheContext,    setNicheContext]     = useState("");
  const [region,          setRegion]           = useState("global");

  // Analysis state
  const [view,         setView]         = useState<"input" | "loading" | "results">("input");
  const [loadingStep,  setLoadingStep]  = useState(0);
  const [result,       setResult]       = useState<GapResult | null>(null);
  const [portfolio,    setPortfolio]    = useState<PortfolioTag[]>([]);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);

  // Results state
  const [activeTab, setActiveTab] = useState<Tab>("gaps");

  // Load portfolio on mount
  useEffect(() => {
    if (!user) return;
    loadPortfolio();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPortfolio = async () => {
    try {
      const { data } = await supabase
        .from("hashtag_requests")
        .select("hashtag_results ( hashtags )")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);

      const tagMap = new Map<string, { count: number; total: number }>();
      for (const row of data ?? []) {
        const results = Array.isArray((row as { hashtag_results: unknown }).hashtag_results)
          ? (row as { hashtag_results: Array<{ hashtags?: { safe?: Array<{ tag: string; score: number }>; experimental?: Array<{ tag: string; score: number }> } }> }).hashtag_results
          : [(row as { hashtag_results?: { hashtags?: { safe?: Array<{ tag: string; score: number }>; experimental?: Array<{ tag: string; score: number }> } } }).hashtag_results];
        for (const res of results) {
          if (!res?.hashtags) continue;
          const allTags = [
            ...(res.hashtags.safe         ?? []),
            ...(res.hashtags.experimental ?? []),
          ];
          for (const h of allTags) {
            const prev = tagMap.get(h.tag) ?? { count: 0, total: 0 };
            tagMap.set(h.tag, { count: prev.count + 1, total: prev.total + h.score });
          }
        }
      }
      const built = Array.from(tagMap.entries()).map(([tag, { count, total }]) => ({
        tag,
        uses: count,
        avg_score: Math.round(total / count),
      }));
      setPortfolio(built);
    } catch (err) {
      console.error("Portfolio load error:", err);
    } finally {
      setPortfolioLoaded(true);
    }
  };

  const handleAnalyze = async () => {
    const competitorTags = parseTags(competitorInput);
    if (competitorTags.length < 2) {
      toast.error("Paste at least 2 competitor hashtags");
      return;
    }
    if (competitorTags.length > 30) {
      toast.error("Max 30 tags per analysis");
      return;
    }

    setView("loading");
    setLoadingStep(0);

    // Step animation
    const stepInterval = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 700);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-hashtag-gaps", {
        body: {
          competitor_tags:  competitorTags,
          user_portfolio:   portfolio,
          niche_context:    nicheContext.trim() || undefined,
          platform:         "instagram",
          region,
        },
      });

      clearInterval(stepInterval);
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data as GapResult);
      setActiveTab("gaps");
      setView("results");
    } catch (err) {
      clearInterval(stepInterval);
      console.error(err);
      toast.error("Analysis failed — try again");
      setView("input");
    }
  };

  // ── Loading view ─────────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">Analysing gaps…</p>
            <p className="text-sm text-muted-foreground">{ANALYSIS_STEPS[loadingStep]}</p>
          </div>
          <div className="space-y-2">
            {ANALYSIS_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  i < loadingStep  ? "bg-primary"           :
                  i === loadingStep ? "bg-primary/40 animate-pulse" :
                  "bg-secondary"
                }`}>
                  {i < loadingStep && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className={`text-xs transition-colors ${
                  i <= loadingStep ? "text-foreground" : "text-muted-foreground"
                }`}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────────

  if (view === "results" && result) {
    const adoptTags = result.gaps.filter((g) => g.verdict === "adopt");
    const testTags  = result.gaps.filter((g) => g.verdict === "test");
    const skipTags  = result.gaps.filter((g) => g.verdict === "skip");
    const overlapCfg = OVERLAP_CONFIG[result.overlap_strength];

    return (
      <div className="h-full overflow-y-auto">
        <div className="p-4 lg:p-6">
          <div className="max-w-3xl mx-auto space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setView("input")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                New analysis
              </button>
              <button
                onClick={() => setView("input")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Change inputs
              </button>
            </div>

            {/* ── Headline banner — the number leads ── */}
            <div className={`post-card p-5 space-y-1 ${
              result.gaps.length > 0
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-emerald-500/30 bg-emerald-500/5"
            }`}>
              {result.gaps.length > 0 ? (
                <>
                  <p className="text-3xl font-bold text-foreground">
                    You're missing{" "}
                    <span className="text-amber-400">{result.gaps.length} high-performing tag{result.gaps.length !== 1 ? "s" : ""}</span>
                    {" "}your competitors use.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {adoptTags.length > 0
                      ? `${adoptTags.length} ready to adopt now · ${testTags.length} worth testing · ${overlapCfg.label.toLowerCase()} with this niche's baseline.`
                      : `${testTags.length} worth testing · ${overlapCfg.label.toLowerCase()} with this niche's baseline.`
                    }
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-foreground">
                    <span className="text-emerald-400">No gaps found</span> — your portfolio already covers this niche.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Strong overlap with the competitor's strategy. See Your Edges tab for what you do differently.
                  </p>
                </>
              )}
            </div>

            {/* Sub-stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="post-card p-3.5 text-center space-y-1">
                <p className={`text-2xl font-bold tabular-nums ${
                  result.gaps.length > 0 ? "text-amber-400" : "text-emerald-400"
                }`}>{result.gaps.length}</p>
                <p className="text-xs text-muted-foreground">Gaps</p>
              </div>
              <div className="post-card p-3.5 text-center space-y-1">
                <p className="text-2xl font-bold text-blue-400 tabular-nums">{result.user_edge.length}</p>
                <p className="text-xs text-muted-foreground">Your Edges</p>
              </div>
              <div className="post-card p-3.5 text-center space-y-1">
                <p className="text-2xl font-bold text-foreground tabular-nums">{result.common_ground.length}</p>
                <p className="text-xs text-muted-foreground">Shared</p>
              </div>
            </div>

            {/* Overlap indicator + strategy summary */}
            <div className="post-card p-4 space-y-3 border-primary/15 bg-primary/3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm font-semibold text-foreground">What this means for you</p>
                <span className={`text-xs font-medium ml-auto ${overlapCfg.color}`}>{overlapCfg.label}</span>
              </div>
              <p className="text-sm text-secondary-foreground leading-relaxed">{result.strategy_summary}</p>
              <p className="text-xs text-muted-foreground">{overlapCfg.note}</p>

              {/* Top actions */}
              <div className="pt-1 space-y-2 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Top Actions</p>
                {result.top_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-foreground leading-snug">{action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              {([
                { key: "gaps" as Tab,      label: `Gaps (${result.gaps.length})`              },
                { key: "user_edge" as Tab, label: `Your Edge (${result.user_edge.length})`    },
                { key: "common" as Tab,    label: `Shared (${result.common_ground.length})`   },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                    activeTab === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Gaps tab ─────────────────────────────────────────────────── */}
            {activeTab === "gaps" && (
              <div className="space-y-4">
                {result.gaps.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-medium text-foreground">No significant gaps found</p>
                    <p className="text-xs text-muted-foreground">Your portfolio already covers this niche's core tags.</p>
                  </div>
                ) : (
                  <>
                    {adoptTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" /> Adopt ({adoptTags.length})
                        </p>
                        {adoptTags.map((g) => <GapCard key={g.tag} gap={g} />)}
                      </div>
                    )}
                    {testTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Minus className="w-3.5 h-3.5" /> Test ({testTags.length})
                        </p>
                        {testTags.map((g) => <GapCard key={g.tag} gap={g} />)}
                      </div>
                    )}
                    {skipTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5" /> Skip ({skipTags.length})
                        </p>
                        {skipTags.map((g) => <GapCard key={g.tag} gap={g} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Your Edge tab ─────────────────────────────────────────────── */}
            {activeTab === "user_edge" && (
              <div className="space-y-2">
                {result.user_edge.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No unique tags in your portfolio vs this competitor.
                  </p>
                ) : (
                  result.user_edge.map((e) => {
                    const cfg = EDGE_CONFIG[e.type];
                    const EdgeIcon = cfg.icon;
                    return (
                      <div key={e.tag} className="post-card px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-foreground">{e.tag}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.pill}`}>
                              <EdgeIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-snug">{e.note}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Common Ground tab ─────────────────────────────────────────── */}
            {activeTab === "common" && (
              <div>
                {result.common_ground.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No shared tags — very different strategies.
                  </p>
                ) : (
                  <div className="post-card p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      These tags appear in both your portfolio and the competitor's list — your baseline niche coverage.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.common_ground.map((tag) => (
                        <span
                          key={tag}
                          className="text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Run analysis on a gap tag */}
            {activeTab === "gaps" && adoptTags.length > 0 && (
              <div className="post-card p-4 flex items-center justify-between gap-3 border-primary/20">
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to use these tags?</p>
                  <p className="text-xs text-muted-foreground">Run a full analysis with your next post caption.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate("/hashtag-analysis")}
                  className="gap-1.5 flex-shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Analyze Post
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ── Input view ───────────────────────────────────────────────────────────────

  const competitorTags = parseTags(competitorInput);
  const isReady = competitorTags.length >= 2 && portfolioLoaded;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/hashtag-analysis")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Hashtag Analysis
            </button>
            {portfolio.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Portfolio: {portfolio.length} unique tags from your history
              </span>
            )}
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Find Your Missing Tags</h1>
              <p className="text-xs text-muted-foreground">
                Paste hashtags that are working in your niche — we'll show you exactly what you're missing.
              </p>
            </div>
          </div>

          {/* Empty portfolio notice */}
          {portfolioLoaded && portfolio.length === 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                No history yet — we'll still score every gap tag on its own merit. Run a few post analyses first to unlock the personal comparison layer.
              </p>
            </div>
          )}

          {/* Competitor tags input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Paste hashtags you've seen working in your niche
              <span className="text-muted-foreground font-normal ml-1.5">— from a competitor post, a top creator, anywhere</span>
            </label>
            <Textarea
              placeholder={"#fitness #healthylifestyle #workout\n\nPaste from any post — one per line, comma-separated, or all at once."}
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              className="min-h-[120px] resize-none font-mono text-sm"
            />
            {competitorTags.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {competitorTags.length} tag{competitorTags.length !== 1 ? "s" : ""} detected
                {competitorTags.length > 30 && (
                  <span className="text-red-400 ml-1">— max 30, remove {competitorTags.length - 30}</span>
                )}
              </p>
            )}
          </div>

          {/* Niche context */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Your Niche / Content Type
              <span className="text-muted-foreground font-normal ml-1.5">— optional but improves accuracy</span>
            </label>
            <Input
              placeholder="e.g. sustainable fashion for women 25–35, B2B SaaS marketing, fitness coaching"
              value={nicheContext}
              onChange={(e) => setNicheContext(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Region</label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Analyze button */}
          <Button
            onClick={handleAnalyze}
            disabled={!isReady || competitorTags.length > 30}
            className="w-full gap-2 text-sm font-semibold"
            size="lg"
          >
            {!portfolioLoaded
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />
            }
            {!portfolioLoaded ? "Loading your portfolio…" : "Find My Missing Tags"}
          </Button>

          {/* How it works */}
          <div className="post-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How it works</p>
            <div className="space-y-2.5">
              {[
                { step: "1", text: "Paste any hashtags working in your niche — from a competitor post, a top creator, or your own research." },
                { step: "2", text: "We compare them against your full hashtag history to surface exactly what you're not using but should be." },
                { step: "3", text: "Every gap tag is scored and labelled: Adopt it now, Test it first, or Skip — with a one-line reason why." },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step}
                  </span>
                  <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HashtagGapAnalysis;
