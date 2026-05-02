import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GeneratedTweet } from "@/types/trends";
import { Copy, Check, ArrowLeft, Twitter, AlertTriangle, BookmarkCheck, Sparkles, AlertCircle, Radio, RadioTower, RadioReceiver, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface TwitterContentProps {
  trendName: string;
  tweets: GeneratedTweet[];
  charLimit: number;
  onBack: () => void;
  /** Whether the drafts were persisted to tweet_drafts during generation. */
  saved?: boolean;
  /** If saving failed, the underlying error message. */
  saveError?: string | null;
  /**
   * Result of the in-flight Marketers Quest live search the edge function ran
   * before drafting. Lets users know whether the tweets are anchored in
   * fresh news ('live'), thin/old context ('stale'), or just brand voice
   * with no upstream context ('none').
   */
  liveContextSource?: 'live' | 'stale' | 'none' | null;
  /** First ~400 chars of the live-context block, for the expandable detail. */
  liveContextPreview?: string | null;
}

// ── Live-context pill ──────────────────────────────────────────────────────
const LIVE_CONTEXT_CONFIG = {
  live: {
    label: 'Live context',
    tooltip: 'Fresh news pulled in seconds ago — these tweets are grounded in current reality',
    icon: RadioTower,
    pill: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  stale: {
    label: 'Weak context',
    tooltip: 'Live search returned thin or stale info — sanity-check facts before posting',
    icon: Radio,
    pill: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  none: {
    label: 'No live context',
    tooltip: 'Live search came up empty — drafts are based on the trend name and your brand voice. Treat as a starting point.',
    icon: RadioReceiver,
    pill: 'bg-muted text-muted-foreground border-border/50',
    dot: 'bg-muted-foreground/60',
  },
} as const;

const CharBar = ({ count, limit }: { count: number; limit: number }) => {
  const pct = Math.min(100, (count / limit) * 100);
  const remaining = limit - count;
  const isOver = count > limit;
  const isWarning = !isOver && remaining <= Math.round(limit * 0.1); // last 10%

  const barColor = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground';

  return (
    <div className="space-y-1">
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`text-[10px] font-medium text-right ${textColor}`}>
        {isOver
          ? `${Math.abs(remaining)} over limit`
          : `${remaining} chars left`}
      </div>
    </div>
  );
};

const ANGLE_COLORS: Record<string, string> = {
  'Hot take':    'bg-red-500/15 text-red-500 border-red-500/30',
  'Humour':      'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'Educational': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'Opinion':     'bg-purple-500/15 text-purple-500 border-purple-500/30',
  'Relatable':   'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
};

const getAngleColor = (angle: string) => {
  for (const [key, val] of Object.entries(ANGLE_COLORS)) {
    if (angle.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'bg-secondary text-muted-foreground border-border';
};

export const TwitterContent = ({
  trendName,
  tweets,
  charLimit,
  onBack,
  saved,
  saveError,
  liveContextSource,
  liveContextPreview,
}: TwitterContentProps) => {
  const [copied, setCopied] = useState<number | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const liveCfg = liveContextSource ? LIVE_CONTEXT_CONFIG[liveContextSource] : null;
  const LiveIcon = liveCfg?.icon;
  const hasPreview = !!liveContextPreview && liveContextPreview.trim().length > 0;

  const handleCopy = async (tweet: GeneratedTweet) => {
    await navigator.clipboard.writeText(tweet.text);
    setCopied(tweet.draft_id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const isPremium = charLimit > 280;

  if (tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <Twitter className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No tweets generated. Try refreshing.</p>
        <Button onClick={onBack} variant="outline" size="sm" className="mt-4 gap-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to trends
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Button onClick={onBack} variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Twitter className="w-4 h-4 text-[#1DA1F2]" />
              <h3 className="text-sm font-semibold text-foreground">Tweet drafts</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-1">
            Trend: <span className="text-foreground font-medium">{trendName}</span>
            <span className="ml-2 text-muted-foreground/60">·</span>
            <span className="ml-2">{isPremium ? 'Premium' : 'Standard'} ({charLimit.toLocaleString()} chars)</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
        {/* Live-context pill */}
        {liveCfg && LiveIcon && (
          <button
            type="button"
            onClick={() => hasPreview && setContextOpen(o => !o)}
            disabled={!hasPreview}
            title={liveCfg.tooltip}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${liveCfg.pill} ${hasPreview ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
            aria-expanded={contextOpen}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${liveCfg.dot}`} />
            <LiveIcon className="w-3.5 h-3.5" />
            {liveCfg.label}
            {hasPreview && (contextOpen
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Persistence indicator */}
        <Link
          to="/tweet-drafts"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            saved
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15'
              : saveError
              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/15'
              : 'bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/60'
          }`}
          title={saveError || (saved ? 'Drafts saved automatically' : 'Open My Drafts')}
        >
          {saved ? (
            <>
              <BookmarkCheck className="w-3.5 h-3.5" />
              Saved · View all
            </>
          ) : saveError ? (
            <>
              <AlertCircle className="w-3.5 h-3.5" />
              Not saved · View archive
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              My Drafts
            </>
          )}
        </Link>
        </div>
      </div>

      {/* Live-context preview (collapsed by default) */}
      {liveCfg && hasPreview && contextOpen && (
        <div className={`mb-4 p-3 rounded-lg border text-xs ${liveCfg.pill}`}>
          <div className="flex items-center gap-1.5 mb-1.5 font-semibold">
            {LiveIcon && <LiveIcon className="w-3.5 h-3.5" />}
            What the live search returned
          </div>
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap font-normal">
            {liveContextPreview}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground/80">
            This is what the AI saw before drafting. If it looks wrong or missing, refresh the trend or try a different one.
          </p>
        </div>
      )}

      {/* Tweet cards */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {tweets.map((tweet) => (
          <div
            key={tweet.draft_id}
            className={`post-card p-4 ${tweet.over_limit ? 'border-red-500/30 bg-red-500/5' : ''}`}
          >
            {/* Angle tag + copy button */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getAngleColor(tweet.angle)}`}>
                {tweet.angle}
              </span>
              <button
                onClick={() => handleCopy(tweet)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === tweet.draft_id
                  ? <><Check className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-500">Copied!</span></>
                  : <><Copy className="w-3.5 h-3.5" />Copy</>}
              </button>
            </div>

            {/* Tweet text */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/40">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-[system-ui]">
                {tweet.text}
              </p>
            </div>

            {/* Character bar */}
            <div className="mt-3">
              <CharBar count={tweet.char_count} limit={charLimit} />
            </div>

            {/* Over limit warning */}
            {tweet.over_limit && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                This draft exceeds the character limit — trim before posting
              </div>
            )}

            {/* Hashtags */}
            {tweet.hashtags && tweet.hashtags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {tweet.hashtags.map((tag) => (
                  <span key={tag} className="text-[11px] text-primary/70 font-medium">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
