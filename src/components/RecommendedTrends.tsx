import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RecommendedTrend, TrendTiming, TrendCategory } from "@/types/trends";
import { TrendingUp, ArrowRight, RefreshCw, Zap, Clock, Flame, ShieldCheck, AlertTriangle, Youtube, ThumbsUp, MessageCircle } from "lucide-react";

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

/**
 * Renders observation lifecycle copy honestly.
 *   - first_seen_at → "Broke Xh ago" (real, measured)
 *   - peaked_at      → "Peaked Yh ago" — but only when set
 *   - peaked_at NULL → "Still climbing" — only when virality is current peak
 * Never invents a peak time. If we have no first_seen_at, render nothing.
 */
const LifecycleBadge = ({
  firstSeenAt,
  peakedAt,
  viralityScore,
  peakViralityScore,
}: {
  firstSeenAt?: string | null;
  peakedAt?: string | null;
  viralityScore?: number;
  peakViralityScore?: number | null;
}) => {
  if (!firstSeenAt) return null;
  const ageHours = Math.max(0, (Date.now() - new Date(firstSeenAt).getTime()) / 36e5);
  const ageLabel = ageHours < 1
    ? 'Broke <1h ago'
    : ageHours < 48
      ? `Broke ${Math.round(ageHours)}h ago`
      : `Broke ${Math.round(ageHours / 24)}d ago`;

  // Determine peak phase from observation history.
  // We say "still climbing" only when current virality matches the recorded
  // peak AND the peak hasn't been stamped (which means we've never seen a
  // drop). If virality is below peak, we know the trend has come off its
  // high — even if we don't have a peaked_at timestamp.
  let peakPhase: { label: string; tone: 'climbing' | 'past' | 'unknown' } | null = null;
  if (peakViralityScore != null && viralityScore != null) {
    if (peakedAt && viralityScore < peakViralityScore) {
      const peakAgo = Math.max(0, (Date.now() - new Date(peakedAt).getTime()) / 36e5);
      const peakLabel = peakAgo < 1
        ? 'just peaked'
        : peakAgo < 48
          ? `peaked ${Math.round(peakAgo)}h ago`
          : `peaked ${Math.round(peakAgo / 24)}d ago`;
      peakPhase = { label: peakLabel, tone: 'past' };
    } else if (viralityScore >= peakViralityScore) {
      peakPhase = { label: 'still climbing', tone: 'climbing' };
    }
  }

  const tone = peakPhase?.tone === 'climbing'
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
    : peakPhase?.tone === 'past'
      ? 'bg-muted text-muted-foreground border border-border'
      : 'bg-secondary text-muted-foreground border border-border';

  const fullLabel = peakPhase ? `${ageLabel} · ${peakPhase.label}` : ageLabel;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tone}`}
      title={`First seen at ${new Date(firstSeenAt).toLocaleString()}`}
    >
      <Clock className="w-3 h-3" />
      {fullLabel}
    </span>
  );
};

/**
 * Surfaces the cross-source corroboration count as a credibility badge.
 * 3/3 = green shield, 2/3 = blue shield, 1/3 = amber alert ("verify before
 * posting"). Hidden if score is missing — never silently shown as 1/3,
 * since that would falsely imply we checked and found one.
 */
const CorroborationBadge = ({ score }: { score?: number }) => {
  if (score == null) return null;
  if (score >= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            title="Confirmed across all 3 platforms (Google Trends + Reddit + YouTube)">
        <ShieldCheck className="w-3 h-3" />
        3-platform confirmed
      </span>
    );
  }
  if (score === 2) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
            title="Confirmed across 2 distinct platforms">
        <ShieldCheck className="w-3 h-3" />
        2-platform
      </span>
    );
  }
  // score === 1 → single-platform — caveat the user, don't pretend it's strong
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
          title="Single-platform signal only. Verify on the source platform before posting.">
      <AlertTriangle className="w-3 h-3" />
      Single-source — verify
    </span>
  );
};

/**
 * Compact view-count formatter — 1.2K / 4.7M / 12.3M.
 * For honesty: round half-down on the 1-decimal version so we never
 * round 999,000 up to "1M" (it's been 999K, say 999K).
 */
const formatCount = (n: number): string => {
  if (n < 1_000) return n.toString();
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toFixed(1)}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1_000)}K`;
  if (n < 10_000_000) return `${(Math.floor(n / 100_000) / 10).toFixed(1)}M`;
  if (n < 1_000_000_000) return `${Math.floor(n / 1_000_000)}M`;
  return `${(Math.floor(n / 100_000_000) / 10).toFixed(1)}B`;
};

/**
 * Real engagement evidence pulled from YouTube Data API. ONLY renders when
 * we actually have a video match — never shows "0 views" because that would
 * falsely imply we checked and the video flopped. Likes/comments only render
 * when YouTube returned them (creator can disable both, in which case they
 * stay null and we honestly skip them).
 *
 * Hover title shows "fetched X ago" so users can tell if numbers are stale.
 */
const YouTubeEngagementBadge = ({
  videoId,
  videoTitle,
  channelTitle,
  viewCount,
  likeCount,
  commentCount,
  fetchedAt,
}: {
  videoId?: string | null;
  videoTitle?: string | null;
  channelTitle?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  fetchedAt?: string | null;
}) => {
  // Hide entirely when we have no match. yt_video_id is the source of truth
  // — if it's null, every other yt_* field is also null by contract.
  if (!videoId || viewCount == null) return null;

  const fetchedAgo = fetchedAt
    ? (() => {
        const h = (Date.now() - new Date(fetchedAt).getTime()) / 36e5;
        if (h < 1) return 'fetched <1h ago';
        if (h < 48) return `fetched ${Math.round(h)}h ago`;
        return `fetched ${Math.round(h / 24)}d ago`;
      })()
    : '';

  const titleParts = [
    `Best matching recent YouTube video: "${videoTitle || 'untitled'}"`,
    channelTitle ? `Channel: ${channelTitle}` : null,
    fetchedAgo ? `Stats ${fetchedAgo}` : null,
  ].filter(Boolean);

  return (
    <a
      href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`}
      target="_blank"
      rel="noopener noreferrer"
      title={titleParts.join(' · ')}
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/15 transition-colors"
    >
      <Youtube className="w-3 h-3" />
      <span className="tabular-nums">{formatCount(viewCount)} views</span>
      {likeCount != null && (
        <>
          <span className="opacity-50">·</span>
          <ThumbsUp className="w-2.5 h-2.5" />
          <span className="tabular-nums">{formatCount(likeCount)}</span>
        </>
      )}
      {commentCount != null && commentCount > 0 && (
        <>
          <span className="opacity-50">·</span>
          <MessageCircle className="w-2.5 h-2.5" />
          <span className="tabular-nums">{formatCount(commentCount)}</span>
        </>
      )}
    </a>
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
                  <CorroborationBadge score={trend.corroboration_score} />
                  <LifecycleBadge
                    firstSeenAt={trend.first_seen_at}
                    peakedAt={trend.peaked_at}
                    viralityScore={trend.virality_score}
                    peakViralityScore={trend.peak_virality_score}
                  />
                  <YouTubeEngagementBadge
                    videoId={trend.yt_video_id}
                    videoTitle={trend.yt_video_title}
                    channelTitle={trend.yt_channel_title}
                    viewCount={trend.yt_view_count}
                    likeCount={trend.yt_like_count}
                    commentCount={trend.yt_comment_count}
                    fetchedAt={trend.yt_fetched_at}
                  />
                  {trend.region && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {trend.region}
                    </span>
                  )}
                  <CategoryBadge category={trend.category} />
                </div>

                {/* Signal row — render only honest signals.
                    'unknown' is intentionally NOT rendered: it would
                    falsely imply a checked-and-empty result. */}
                {trend.ig_validated === 'not_found' && trend.timing === 'early' && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Not on IG yet — post first
                    </span>
                  </div>
                )}
                {trend.ig_validated === 'confirmed' && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      Already on IG — bring a fresh angle
                    </span>
                  </div>
                )}

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
