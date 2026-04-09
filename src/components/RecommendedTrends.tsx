import { Button } from "@/components/ui/button";
import { RecommendedTrend, TrendTiming } from "@/types/trends";
import { TrendingUp, Eye, ArrowRight, RefreshCw, Zap, Clock, Flame } from "lucide-react";

interface RecommendedTrendsProps {
  recommendations: RecommendedTrend[];
  brandName: string;
  onViewDirections: (trend: RecommendedTrend) => void;
  onRefreshTrends?: () => void;
  isRefreshing?: boolean;
}

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

export const RecommendedTrends = ({
  recommendations,
  brandName,
  onViewDirections,
  onRefreshTrends,
  isRefreshing = false,
}: RecommendedTrendsProps) => {
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
      <div className="flex items-center justify-between mb-3">
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
          <span className="text-xs text-muted-foreground">{recommendations.length} trends</span>
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

      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {recommendations.map((trend) => (
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
