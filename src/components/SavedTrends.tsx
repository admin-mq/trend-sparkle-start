import { Bookmark, Trash2, ArrowRight, Clock, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecommendedTrend, TwitterTrend } from "@/types/trends";
import type { SavedTrend } from "@/hooks/useSavedTrends";

// ── My Trends panel ────────────────────────────────────────────────────────
//
// Surfaced as the 4th tab in the Trend Quest workspace stepper. Lists the
// trends the user clicked / bookmarked from the Trends tab. Auto-expires
// after 48h via the `expires_at` column — we render the time-left badge
// honestly so the user knows the bookmark is temporary.
//
// Click semantics:
//   • "Use this trend" → opens it in the Ideas tab (calls onUseTrend
//     with the original RecommendedTrend snapshot we stored at save-time).
//   • Trash icon → permanent delete from saved list.
//
// We deliberately render a SIMPLER card here than the live Trends list:
// the heavy badges (lifecycle, decay, velocity) on the live card are
// snapshots from save-time and would be misleading 12h later. Show the
// minimum-viable card: name, category, when-saved, expires-in, the
// stored why_good_fit / hook, and the action buttons.

interface SavedTrendsProps {
  savedTrends: SavedTrend[];
  loading?: boolean;
  onUseTrend: (trend: RecommendedTrend) => void;
  onRemoveTrend: (id: string) => void;
  onGenerateTweets?: (trend: TwitterTrend) => void;
}

function hoursUntil(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 3_600_000));
}

function relativeAgo(savedAt: string): string {
  const ms = Date.now() - new Date(savedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export const SavedTrends = ({
  savedTrends,
  loading = false,
  onUseTrend,
  onRemoveTrend,
  onGenerateTweets,
}: SavedTrendsProps) => {
  if (loading && savedTrends.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-12">
        Loading your saved trends…
      </div>
    );
  }

  if (savedTrends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <Bookmark className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No saved trends yet</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Click any trend on the Trends tab to bookmark it here. Saves last 48 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5" />
          My Trends
        </h3>
        <span className="text-xs text-muted-foreground">
          {savedTrends.length} saved · 48h TTL
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {savedTrends.map((s) => {
          const trend = s.trend_snapshot;
          const hoursLeft = hoursUntil(s.expires_at);
          const isExpiringSoon = hoursLeft <= 6;
          return (
            <div
              key={s.id}
              className="post-card relative p-4 hover:shadow-glow transition-shadow"
            >
              {/* Header row: name + category + expiry */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground text-base">
                      {trend?.trend_name || s.trend_name}
                    </h4>
                    {s.trend_category && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {s.trend_category}
                      </span>
                    )}
                    {s.region && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {s.region}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>Saved {relativeAgo(s.saved_at)}</span>
                    <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-amber-500 font-medium' : ''}`}>
                      <Clock className="w-3 h-3" />
                      {hoursLeft <= 0 ? 'expired' : `${hoursLeft}h left`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveTrend(s.id)}
                  title="Remove from My Trends"
                  aria-label="Remove from My Trends"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Why-good-fit and hook from snapshot. These age, but
                  they're what we promised the user when they saved. */}
              {trend?.why_good_fit && (
                <p className="text-sm text-secondary-foreground mt-1 line-clamp-2">
                  {trend.why_good_fit}
                </p>
              )}
              {trend?.example_hook && (
                <div className="hook-highlight mt-3">
                  <p className="text-sm italic text-foreground">
                    "{trend.example_hook}"
                  </p>
                </div>
              )}

              {trend?.source === 'twitter' && trend.twitter_trend_data ? (
                <Button
                  onClick={() => onGenerateTweets?.(trend.twitter_trend_data!)}
                  disabled={!onGenerateTweets}
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-primary hover:text-primary hover:bg-primary/10 gap-1"
                >
                  <Twitter className="w-3.5 h-3.5" />
                  Generate tweets
                  <ArrowRight className="w-3 h-3" />
                </Button>
              ) : (
                <Button
                  onClick={() => trend && onUseTrend(trend)}
                  disabled={!trend}
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-primary hover:text-primary hover:bg-primary/10 gap-1"
                >
                  Use this trend
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
