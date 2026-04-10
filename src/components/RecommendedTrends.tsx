import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RecommendedTrend, TrendTiming, TrendCategory } from "@/types/trends";
import { TrendingUp, Eye, ArrowRight, RefreshCw, Zap, Clock, Flame } from "lucide-react";

interface RecommendedTrendsProps {
  recommendations: RecommendedTrend[];
  brandName: string;
  onViewDirections: (trend: RecommendedTrend) => void;
  onRefreshTrends?: () => void;
  isRefreshing?: boolean;
}

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string }> = {
  Entertainment: { emoji: '🎭', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  Sports:        { emoji: '⚽', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  Music:         { emoji: '🎵', color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30' },
  Tech:          { emoji: '💻', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
  News:          { emoji: '📰', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  Fashion:       { emoji: '💄', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  Food:          { emoji: '🍔', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  Gaming:        { emoji: '🎮', color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30' },
  Finance:       { emoji: '💰', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  Lifestyle:     { emoji: '🌿', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30' },
};

const getCategoryConfig = (cat?: string) =>
  (cat && CATEGORY_CONFIG[cat]) || { emoji: '✨', color: 'bg-secondary text-muted-foreground border-border' };

// ── Sub-components ─────────────────────────────────────────────────────────────
const TimingBadge = ({ timing }: { timing?: TrendTiming }) => {
  if (!timing) return null;

  const config = {
    early: {
      label: 'Early Signal',
      icon: <Zap className="w-3 h-3" />,
      className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    },
    peaking: {
      label: 'Peaking Now',
      icon: <Flame className="w-3 h-3" />,
      className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    },
    saturated: {
      label: 'Saturated',
      icon: <Clock className="w-3 h-3" />,
      className: 'bg-muted text-muted-foreground border border-border',
    },
  };

  const { label, icon, className } = config[timing];

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${className}`}>
      {icon}
      {label}
    </span>
  );
};

const CategoryBadge = ({ category }: { category?: string }) => {
  if (!category) return null;
  const { emoji, color } = getCategoryConfig(category);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${color}`}>
      {emoji} {category}
    </span>
  );
};

const ViralityBar = ({ score }: { score?: number }) => {
  if (!score) return null;
  const width = `${score}%`;
  const color =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-amber-500' :
    'bg-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">{score}</span>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const RecommendedTrends = ({
  recommendations,
  brandName,
  onViewDirections,
  onRefreshTrends,
  isRefreshing = false,
}: RecommendedTrendsProps) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Derive unique categories present in current recommendations
  const availableCategories = useMemo(() => {
    const cats = recommendations
      .map(t => t.category)
      .filter((c): c is string => Boolean(c));
    return [...new Set(cats)].sort();
  }, [recommendations]);

  // Toggle a category chip
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Filter trends for display
  const displayedTrends = useMemo(() => {
    if (selectedCategories.length === 0) return recommendations;
    return recommendations.filter(t => t.category && selectedCategories.includes(t.category));
  }, [recommendations, selectedCategories]);

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No trends yet</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Fill in your brand profile and click "Get AI trend suggestions" to discover what's trending for you.
        </p>
        {onRefreshTrends && (
          <Button
            onClick={onRefreshTrends}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            className="mt-4 gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Fetching fresh trends…' : 'Refresh trends'}
          </Button>
        )}
      </div>
    );
  }

  const earlyCount = recommendations.filter(t => t.timing === 'early').length;

  return (
    <div className="h-full w-full flex flex-col animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
            {brandName ? `Trending for ${brandName}` : 'Recommended trends'}
          </h3>
          {earlyCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {earlyCount} early
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {displayedTrends.length}/{recommendations.length} trends
          </span>
          {onRefreshTrends && (
            <Button
              onClick={onRefreshTrends}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              title="Fetch the latest UK & USA trends"
              className="h-7 px-3 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      {availableCategories.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {/* All chip */}
          <button
            onClick={() => setSelectedCategories([])}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
              selectedCategories.length === 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            }`}
          >
            All
          </button>
          {availableCategories.map(cat => {
            const { emoji } = getCategoryConfig(cat);
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {emoji} {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state for filtered view */}
      {displayedTrends.length === 0 && selectedCategories.length > 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
          <p className="text-muted-foreground text-sm">
            No trends in <strong>{selectedCategories.join(', ')}</strong> right now.
          </p>
          <button
            onClick={() => setSelectedCategories([])}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Trend cards */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {displayedTrends.map((trend) => (
          <div
            key={trend.trend_id}
            className={`post-card p-4 hover:shadow-glow transition-shadow ${
              trend.timing === 'early' ? 'border-emerald-500/30 bg-emerald-500/5' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Name + badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-foreground text-base">
                    {trend.trend_name}
                  </h4>
                  <TimingBadge timing={trend.timing} />
                  {trend.region && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {trend.region}
                    </span>
                  )}
                  <CategoryBadge category={trend.category} />
                </div>

                {/* Views + virality */}
                <div className="flex items-center gap-3 mt-1.5">
                  {trend.views_last_60h_millions != null && (
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {trend.views_last_60h_millions}M views in 60h
                      </span>
                    </div>
                  )}
                  {trend.ig_confirmed === false && trend.timing === 'early' && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Not on IG yet — post first
                    </span>
                  )}
                </div>

                {/* Virality score bar */}
                {trend.virality_score != null && (
                  <div className="mt-2">
                    <ViralityBar score={trend.virality_score} />
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-secondary-foreground mt-3 line-clamp-2">
              {trend.why_good_fit}
            </p>

            <div className="hook-highlight mt-3">
              <p className="text-sm italic text-foreground">
                "{trend.example_hook}"
              </p>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              {trend.angle_summary}
            </p>

            {/* Sources */}
            {trend.source_signals && trend.source_signals.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {trend.source_signals.map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {s.replace('google_trends_', 'GT ').replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}

            <Button
              onClick={() => onViewDirections(trend)}
              variant="ghost"
              size="sm"
              className="mt-3 text-primary hover:text-primary hover:bg-primary/10 gap-1"
            >
              View creative directions
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
