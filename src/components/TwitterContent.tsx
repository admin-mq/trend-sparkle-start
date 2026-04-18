import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GeneratedTweet } from "@/types/trends";
import { Copy, Check, ArrowLeft, Twitter, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TwitterContentProps {
  trendName: string;
  tweets: GeneratedTweet[];
  charLimit: number;
  onBack: () => void;
}

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

export const TwitterContent = ({ trendName, tweets, charLimit, onBack }: TwitterContentProps) => {
  const [copied, setCopied] = useState<number | null>(null);

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
      <div className="flex items-center justify-between mb-4">
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
      </div>

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
