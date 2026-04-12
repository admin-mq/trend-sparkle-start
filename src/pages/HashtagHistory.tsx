import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Hash, ArrowLeft, Shield, FlaskConical, BarChart2,
  Eye, Bookmark, Share2, Calendar, ChevronRight,
  Zap, Clock, AlertTriangle, CheckCircle2, Loader2,
  Target,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  created_at: string;
  caption: string;
  platform: string;
  region: string;
  goal_type: string;
  brand_name: string | null;
  hashtag_results: {
    set_score: number;
    confidence_level: string;
    hashtags: {
      safe: Array<{ tag: string; score: number; role: string }>;
      experimental: Array<{ tag: string; score: number; role: string }>;
    };
    positioning_score: number | null;
    positioning_verdict: "aligned" | "minor_drift" | "significant_mismatch" | null;
  } | null;
  hashtag_outcomes: {
    set_chosen: "safe" | "experimental" | null;
    views: number | null;
    saves: number | null;
    shares: number | null;
    follows_gained: number | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIDENCE_PILL: Record<string, string> = {
  high:         "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  moderate:     "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  experimental: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
};

const REGION_LABELS: Record<string, string> = {
  global: "Global", US: "United States", UK: "United Kingdom",
  IN: "India", AU: "Australia", CA: "Canada", UAE: "UAE",
  SG: "Singapore", DE: "Germany", BR: "Brazil",
};

const GOAL_LABELS: Record<string, string> = {
  reach: "Reach", engagement: "Engagement", followers: "Followers",
  sales: "Sales", community: "Community",
};

const VERDICT_CONFIG = {
  aligned: {
    label: "Aligned",
    pill: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  minor_drift: {
    label: "Minor Drift",
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  significant_mismatch: {
    label: "Mismatch",
    pill: "bg-red-500/15 text-red-400 border border-red-500/30",
    dot: "bg-red-400",
  },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ScoreBadge({ score, isSafe }: { score: number; isSafe: boolean }) {
  const color = isSafe
    ? score >= 80 ? "text-emerald-400" : score >= 65 ? "text-amber-400" : "text-red-400"
    : score >= 75 ? "text-orange-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <span className={`text-sm font-bold tabular-nums ${color}`}>{score}</span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const HashtagHistory = () => {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [entries,  setEntries]  = useState<HistoryEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hashtag_requests")
        .select(`
          id, created_at, caption, platform, region, goal_type, brand_name,
          hashtag_results ( set_score, confidence_level, hashtags, positioning_score, positioning_verdict ),
          hashtag_outcomes ( set_chosen, views, saves, shares, follows_gained )
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setEntries((data ?? []) as unknown as HistoryEntry[]);
    } catch (err) {
      console.error("History load error:", err);
      toast.error("Couldn't load history");
    } finally {
      setLoading(false);
    }
  };

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Loading your research history...</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-start justify-center p-6 pt-14">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Hash className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No analyses yet</h2>
          <p className="text-sm text-muted-foreground">
            Run your first hashtag analysis and it will appear here.
          </p>
          <Button onClick={() => navigate("/hashtag-analysis")} className="gap-2">
            <Zap className="w-4 h-4" />
            Analyze a Post
          </Button>
        </div>
      </div>
    );
  }

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 lg:p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/hashtag-analysis")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Hashtag Analysis
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {entries.length} {entries.length === 1 ? "analysis" : "analyses"}
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Research History</h1>
            <p className="text-sm text-muted-foreground">
              All your past hashtag analyses — tap to see the full sets.
            </p>
          </div>

          {/* Entry list */}
          <div className="space-y-3">
            {entries.map((entry) => {
              const result   = entry.hashtag_results;
              const outcome  = entry.hashtag_outcomes;
              const isOpen   = expanded === entry.id;
              const safeSet  = result?.hashtags?.safe         ?? [];
              const expSet   = result?.hashtags?.experimental ?? [];
              const hasMetrics = outcome && (outcome.views || outcome.saves || outcome.shares || outcome.follows_gained);
              const verdict  = result?.positioning_verdict ? VERDICT_CONFIG[result.positioning_verdict] : null;

              return (
                <div
                  key={entry.id}
                  className="post-card overflow-hidden border border-border hover:border-primary/30 transition-colors"
                >
                  {/* Row header — always visible */}
                  <button
                    className="w-full text-left px-4 py-3.5 hover:bg-secondary/10 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Caption snippet */}
                        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-1.5">
                          {entry.caption}
                        </p>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {timeAgo(entry.created_at)}
                          </span>
                          <span className="text-muted-foreground/40 text-xs">·</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {REGION_LABELS[entry.region] ?? entry.region}
                          </span>
                          <span className="text-muted-foreground/40 text-xs">·</span>
                          <span className="text-xs text-muted-foreground">
                            {GOAL_LABELS[entry.goal_type] ?? entry.goal_type}
                          </span>
                          {entry.brand_name && (
                            <>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <span className="text-xs text-muted-foreground">{entry.brand_name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right side: scores + chosen badge */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {result && (
                          <div className="hidden sm:flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-primary/60" />
                              <ScoreBadge score={result.set_score} isSafe={true} />
                            </div>
                            {result.confidence_level && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CONFIDENCE_PILL[result.confidence_level]}`}>
                                {result.confidence_level === "high" ? "High" : result.confidence_level === "moderate" ? "Mod." : "Exp."}
                              </span>
                            )}
                            {verdict && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${verdict.pill}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${verdict.dot}`} />
                                {verdict.label}
                              </span>
                            )}
                          </div>
                        )}
                        {outcome?.set_chosen && (
                          <span className={`hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            outcome.set_chosen === "safe"
                              ? "bg-primary/10 text-primary"
                              : "bg-orange-500/10 text-orange-400"
                          }`}>
                            {outcome.set_chosen === "safe"
                              ? <><Shield className="w-3 h-3" /> Safe</>
                              : <><FlaskConical className="w-3 h-3" /> Exp.</>
                            }
                          </span>
                        )}
                        {hasMetrics && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-border animate-fade-in">

                      {/* A/B sets */}
                      {result && (
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Safe set */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Shield className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-primary">Safe Reach</span>
                              <span className="ml-auto text-xs font-bold text-primary tabular-nums">{result.set_score}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {safeSet.map((h) => (
                                <span key={h.tag} className={`text-xs px-2 py-1 rounded-md font-medium bg-primary/10 text-primary ${
                                  outcome?.set_chosen === "safe" ? "ring-1 ring-primary/40" : ""
                                }`}>
                                  {h.tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Experimental set */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 mb-2">
                              <FlaskConical className="w-3.5 h-3.5 text-orange-400" />
                              <span className="text-xs font-semibold text-orange-400">Experimental</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {expSet.map((h) => (
                                <span key={h.tag} className={`text-xs px-2 py-1 rounded-md font-medium bg-orange-500/10 text-orange-400 ${
                                  outcome?.set_chosen === "experimental" ? "ring-1 ring-orange-500/40" : ""
                                }`}>
                                  {h.tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Positioning score */}
                      {result?.positioning_verdict && verdict && (
                        <div className="px-4 pb-3 border-t border-border pt-3">
                          <div className="flex items-center gap-2">
                            <Target className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">Content Positioning</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 ml-1 ${verdict.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${verdict.dot}`} />
                              {verdict.label}
                            </span>
                            {result.positioning_score != null && (
                              <span className="ml-auto text-xs font-semibold text-foreground tabular-nums">
                                {result.positioning_score}<span className="text-muted-foreground font-normal">/100</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Performance data if logged */}
                      {hasMetrics ? (
                        <div className="px-4 pb-4 border-t border-border pt-3">
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Performance
                              {outcome?.set_chosen && (
                                <span className={`ml-1.5 normal-case font-normal ${
                                  outcome.set_chosen === "safe" ? "text-primary" : "text-orange-400"
                                }`}>
                                  ({outcome.set_chosen === "safe" ? "Safe set" : "Experimental set"})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4">
                            {outcome?.views != null && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-semibold text-foreground">{outcome.views.toLocaleString()}</span>
                                <span className="text-muted-foreground text-xs">views</span>
                              </div>
                            )}
                            {outcome?.saves != null && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-semibold text-foreground">{outcome.saves.toLocaleString()}</span>
                                <span className="text-muted-foreground text-xs">saves</span>
                              </div>
                            )}
                            {outcome?.shares != null && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-semibold text-foreground">{outcome.shares.toLocaleString()}</span>
                                <span className="text-muted-foreground text-xs">shares</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 pb-4 border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            No performance data logged yet for this post.
                          </p>
                        </div>
                      )}

                      {/* Re-analyze button */}
                      <div className="px-4 pb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => navigate("/hashtag-analysis", {
                            state: { prefillCaption: entry.caption, platform: entry.platform, region: entry.region, goal: entry.goal_type }
                          })}
                        >
                          <Zap className="w-3 h-3" />
                          Re-analyze this post
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default HashtagHistory;
