import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bookmark, ArrowLeft, TrendingUp, TrendingDown, Minus,
  RefreshCw, Trash2, Hash, Loader2, AlertCircle, Zap, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrendStatus = "rising" | "plateauing" | "declining";

interface WatchlistEntry {
  id: string;
  tag: string;
  source_set: "safe" | "experimental" | null;
  added_at: string;
  last_checked_at: string | null;
  trend_status: TrendStatus | null;
  trend_score: number | null;
  trend_note: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TrendStatus, {
  label: string;
  pill: string;
  icon: React.ElementType;
  bar: string;
}> = {
  rising: {
    label: "Rising",
    pill: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    icon: TrendingUp,
    bar: "bg-emerald-500",
  },
  plateauing: {
    label: "Plateauing",
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    icon: Minus,
    bar: "bg-amber-400",
  },
  declining: {
    label: "Declining",
    pill: "bg-red-500/15 text-red-400 border border-red-500/30",
    icon: TrendingDown,
    bar: "bg-red-500",
  },
};

const STALE_DAYS = 7;

function isStale(last_checked_at: string | null) {
  if (!last_checked_at) return true;
  return Date.now() - new Date(last_checked_at).getTime() > STALE_DAYS * 86_400_000;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 2)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

const HashtagWatchlist = () => {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [entries,  setEntries]  = useState<WatchlistEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [checking, setChecking] = useState(false);
  const [filter,   setFilter]   = useState<"all" | TrendStatus>("all");

  useEffect(() => {
    if (!user) return;
    loadWatchlist();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hashtag_watchlist")
        .select("id, tag, source_set, added_at, last_checked_at, trend_status, trend_score, trend_note")
        .eq("user_id", user!.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      setEntries((data ?? []) as WatchlistEntry[]);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load watchlist");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckTrends = async () => {
    if (!user || entries.length === 0) return;
    setChecking(true);
    try {
      const tags = entries.map((e) => e.tag);
      const { data, error } = await supabase.functions.invoke("check-watchlist-trends", {
        body: { tags, user_id: user.id },
      });
      if (error) throw error;

      type ResultRow = { tag: string; status: TrendStatus; score: number; note: string };
      const resultMap = new Map<string, Omit<ResultRow, "tag">>(
        (data.results ?? []).map((r: ResultRow) => [r.tag, { status: r.status, score: r.score, note: r.note }])
      );

      const now = new Date().toISOString();
      setEntries((prev) =>
        prev.map((e) => {
          const u = resultMap.get(e.tag);
          return u
            ? { ...e, trend_status: u.status, trend_score: u.score, trend_note: u.note, last_checked_at: now }
            : e;
        })
      );

      toast.success(`Trend status updated for ${resultMap.size} tag${resultMap.size === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Trend check failed — try again");
    } finally {
      setChecking(false);
    }
  };

  const handleUnpin = async (entry: WatchlistEntry) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    const { error } = await supabase
      .from("hashtag_watchlist")
      .delete()
      .eq("id", entry.id);
    if (error) {
      toast.error("Couldn't remove tag");
      loadWatchlist();
    } else {
      toast.success(`${entry.tag} removed from watchlist`);
    }
  };

  const filtered   = filter === "all" ? entries : entries.filter((e) => e.trend_status === filter);
  const staleCount = entries.filter((e) => isStale(e.last_checked_at)).length;

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Loading watchlist...</span>
        </div>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-start justify-center p-6 pt-14">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Bookmark className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No tags pinned yet</h2>
          <p className="text-sm text-muted-foreground">
            Pin individual hashtags from any analysis to track whether they're rising, plateauing, or declining over time.
          </p>
          <Button onClick={() => navigate("/hashtag-analysis")} className="gap-2">
            <Zap className="w-4 h-4" />
            Analyze a Post
          </Button>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────────

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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hash className="w-3.5 h-3.5" />
              {entries.length} {entries.length === 1 ? "tag" : "tags"} pinned
            </div>
          </div>

          {/* Title + Check button */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Hashtag Watchlist</h1>
              <p className="text-sm text-muted-foreground">
                Track whether your pinned tags are rising, plateauing, or declining.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheckTrends}
              disabled={checking}
              className="gap-1.5 flex-shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            >
              {checking
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
              {checking ? "Checking..." : "Check Trends"}
            </Button>
          </div>

          {/* Stale warning */}
          {staleCount > 0 && !checking && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                {staleCount === 1
                  ? "1 tag hasn't"
                  : `${staleCount} tags haven't`
                } been checked in {STALE_DAYS}+ days — hit "Check Trends" to refresh.
              </p>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "rising", "plateauing", "declining"] as const).map((f) => {
              const count = f === "all"
                ? entries.length
                : entries.filter((e) => e.trend_status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : STATUS_CONFIG[f].label} ({count})
                </button>
              );
            })}
          </div>

          {/* Tag grid */}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tags with "{filter}" status yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((entry) => {
                const cfg        = entry.trend_status ? STATUS_CONFIG[entry.trend_status] : null;
                const stale      = isStale(entry.last_checked_at);
                const StatusIcon = cfg?.icon;

                return (
                  <div
                    key={entry.id}
                    className="post-card p-4 space-y-3 hover:border-primary/30 transition-colors"
                  >
                    {/* Tag name + unpin */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-base font-bold text-foreground break-all">{entry.tag}</span>
                      <button
                        onClick={() => handleUnpin(entry)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors rounded flex-shrink-0"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Status + score */}
                    {cfg ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.pill}`}>
                            {StatusIcon && <StatusIcon className="w-3 h-3" />}
                            {cfg.label}
                          </span>
                          {entry.trend_score != null && (
                            <span className="text-xs font-semibold text-foreground tabular-nums ml-auto">
                              {entry.trend_score}
                              <span className="text-muted-foreground font-normal">/100</span>
                            </span>
                          )}
                        </div>
                        {entry.trend_score != null && (
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                              style={{ width: `${entry.trend_score}%` }}
                            />
                          </div>
                        )}
                        {entry.trend_note && (
                          <p className="text-xs text-muted-foreground leading-snug">{entry.trend_note}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Not checked yet — hit "Check Trends" above.
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border flex-wrap">
                      {entry.source_set && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          entry.source_set === "safe"
                            ? "bg-primary/10 text-primary"
                            : "bg-orange-500/10 text-orange-400"
                        }`}>
                          {entry.source_set === "safe" ? "Safe set" : "Exp. set"}
                        </span>
                      )}
                      <div className={`flex items-center gap-1 text-[10px] ml-auto ${
                        stale ? "text-amber-400" : "text-muted-foreground"
                      }`}>
                        {stale
                          ? <AlertCircle className="w-3 h-3" />
                          : <CheckCircle2 className="w-3 h-3" />
                        }
                        {entry.last_checked_at
                          ? `Checked ${timeAgo(entry.last_checked_at)}`
                          : "Never checked"
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default HashtagWatchlist;
