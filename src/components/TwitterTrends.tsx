import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TwitterTrend, TwitterTrendsResponse } from "@/types/trends";
import { TrendingUp, ArrowRight, RefreshCw, Zap, TrendingDown, Minus, CheckCircle, AlertCircle, HelpCircle, Twitter } from "lucide-react";

interface TwitterTrendsProps {
  data: TwitterTrendsResponse;
  onGenerateTweets: (trend: TwitterTrend) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// ── Velocity badge ─────────────────────────────────────────────────────────
const VelocityBadge = ({ velocity }: { velocity: TwitterTrend['velocity'] }) => {
  const config = {
    rising: {
      label: 'Rising',
      icon: <TrendingUp className="w-3 h-3" />,
      className: 'bg-red-500/15 text-red-500 border-red-500/30',
    },
    stable: {
      label: 'Stable',
      icon: <Minus className="w-3 h-3" />,
      className: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    },
    fading: {
      label: 'Fading',
      icon: <TrendingDown className="w-3 h-3" />,
      className: 'bg-muted text-muted-foreground border-border',
    },
  };
  const { label, icon, className } = config[velocity] || config.stable;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${className}`}>
      {icon}{label}
    </span>
  );
};

// ── Confidence indicator ───────────────────────────────────────────────────
const ConfidenceBadge = ({ confidence }: { confidence: TwitterTrend['confidence'] }) => {
  const config = {
    high:   { icon: <CheckCircle className="w-3 h-3" />, label: 'Verified',   className: 'text-emerald-500' },
    medium: { icon: <AlertCircle className="w-3 h-3" />, label: 'Likely',     className: 'text-amber-500' },
    low:    { icon: <HelpCircle className="w-3 h-3" />,  label: 'Unverified', className: 'text-muted-foreground' },
  };
  const { icon, label, className } = config[confidence] || config.low;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${className}`}>
      {icon}{label}
    </span>
  );
};

// ── Category badge ─────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  Entertainment: '🎭', Music: '🎵', Politics: '🏛️', Sports: '⚽',
  Tech: '💻', AI: '🤖', Gaming: '🎮', Culture: '🌍',
  Finance: '💰', News: '📰', Religion: '✝️', Fashion: '💄',
  Entrepreneurship: '🚀',
};

const CategoryBadge = ({ category }: { category: string }) => {
  const emoji = CATEGORY_EMOJI[category] || '✨';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
      {emoji} {category}
    </span>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export const TwitterTrends = ({ data, onGenerateTweets, onRefresh, isRefreshing = false }: TwitterTrendsProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const categories = useMemo(() => {
    const cats = data.trends.map(t => t.category).filter(Boolean);
    return [...new Set(cats)].sort();
  }, [data.trends]);

  const displayed = useMemo(() =>
    selectedCategory ? data.trends.filter(t => t.category === selectedCategory) : data.trends,
    [data.trends, selectedCategory]
  );

  const risingCount = data.trends.filter(t => t.velocity === 'rising').length;
  const verifiedCount = data.trends.filter(t => t.confidence === 'high').length;

  if (data.trends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <Twitter className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Twitter trends found</h3>
        <p className="text-muted-foreground text-sm max-w-md mb-4">
          Try a different region or remove category filters.
        </p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm" disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Scanning…' : 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Twitter className="w-3.5 h-3.5 text-[#1DA1F2]" />
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
              X Trends · {data.region}
            </h3>
          </div>
          {risingCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30">
              {risingCount} rising
            </span>
          )}
          {verifiedCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {verifiedCount} verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{displayed.length}/{data.trends.length}</span>
          {onRefresh && (
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              className="h-7 px-3 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Scanning…' : 'Refresh'}
            </Button>
          )}
        </div>
      </div>

      {/* Top insight */}
      {data.top_insight && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
          <span className="font-semibold">💡 Marketer insight: </span>{data.top_insight}
        </div>
      )}

      {/* Category filter chips */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <button
            onClick={() => setSelectedCategory('')}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
              !selectedCategory
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(prev => prev === cat ? '' : cat)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              {CATEGORY_EMOJI[cat] || '✨'} {cat}
            </button>
          ))}
        </div>
      )}

      {/* Trend cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-2">
        {displayed.map((trend) => (
          <div
            key={`${trend.rank}-${trend.name}`}
            className={`post-card p-4 hover:shadow-glow transition-shadow ${
              trend.velocity === 'rising' ? 'border-red-500/20 bg-red-500/3' : ''
            }`}
          >
            {/* Rank + name + badges */}
            <div className="flex items-start gap-2.5">
              <span className="text-lg font-bold text-muted-foreground/40 leading-none mt-0.5 w-6 flex-shrink-0">
                {trend.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-foreground text-base">
                    {trend.name}
                  </h4>
                  <VelocityBadge velocity={trend.velocity} />
                  <CategoryBadge category={trend.category} />
                </div>

                {/* Confidence + freshness */}
                <div className="flex items-center gap-3 mt-1">
                  <ConfidenceBadge confidence={trend.confidence} />
                  {trend.freshness_hours > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ~{trend.freshness_hours}h trending
                    </span>
                  )}
                </div>

                {/* Why trending */}
                {trend.why_trending && trend.confidence !== 'low' && (
                  <p className="text-sm text-secondary-foreground mt-2">
                    {trend.why_trending}
                  </p>
                )}
                {trend.confidence === 'low' && (
                  <p className="text-sm text-muted-foreground/60 italic mt-2">
                    Context unverified — proceed with caution
                  </p>
                )}

                {/* Marketer signal */}
                {trend.marketer_signal && (
                  <div className="mt-2 px-2 py-1.5 rounded bg-primary/5 border border-primary/15">
                    <p className="text-xs text-primary font-medium">
                      <Zap className="w-3 h-3 inline mr-1" />
                      {trend.marketer_signal}
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => onGenerateTweets(trend)}
                  variant="ghost"
                  size="sm"
                  disabled={trend.confidence === 'low'}
                  className="mt-3 text-primary hover:text-primary hover:bg-primary/10 gap-1"
                >
                  {trend.confidence === 'low' ? 'Context unverified' : 'Generate tweets'}
                  {trend.confidence !== 'low' && <ArrowRight className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
