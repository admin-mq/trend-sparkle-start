import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailedDirection, UserProfile } from "@/types/trends";
import {
  ArrowLeft, FileText, Hash, Lightbulb, Play, MessageSquare,
  Heart, Meh, ThumbsDown, Zap, Loader2, ExternalLink, Mic2,
  AlignLeft, AlignJustify, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface ExecutionBlueprintProps {
  trendName: string;
  ideaTitle: string;
  blueprint: DetailedDirection | null;
  trendHashtags: string;
  onBack: () => void;
  /** Navigate to deep hashtag analysis (saves state there) */
  onDeepHashtagAnalysis?: () => void;
  userProfile?: UserProfile | null;
  contentFormat?: string;
  onFeedback?: (params: {
    outputType: "caption" | "blueprint";
    newOutput: string;
    userFeedback: "love" | "ok" | "dislike";
  }) => void;
}

export const ExecutionBlueprint = ({
  trendName,
  ideaTitle,
  blueprint,
  trendHashtags,
  onBack,
  onDeepHashtagAnalysis,
  userProfile,
  contentFormat,
  onFeedback,
}: ExecutionBlueprintProps) => {
  const isVideo = /video|reels|tiktok/i.test(contentFormat || "");

  // Caption tab: "short" | "long"
  const [captionTab, setCaptionTab] = useState<"short" | "long">("short");

  // Script expand/collapse
  const [scriptExpanded, setScriptExpanded] = useState(false);

  // Inline hashtag optimization
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedHashtags, setOptimizedHashtags] = useState<string[] | null>(null);

  if (!blueprint) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No blueprint yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Select a creative direction to generate an execution blueprint.
        </p>
      </div>
    );
  }

  const handleOptimizeInline = async () => {
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-hashtags-inline", {
        body: {
          caption: blueprint.caption,
          current_hashtags: blueprint.recommended_hashtags,
          niche: userProfile?.niche || userProfile?.industry || "",
          platform: userProfile?.platform || "Instagram",
          trend_name: trendName,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setOptimizedHashtags(data.hashtags || []);
    } catch (e) {
      toast.error("Could not optimise hashtags. Try again.");
    } finally {
      setOptimizing(false);
    }
  };

  const displayHashtags = optimizedHashtags ?? blueprint.recommended_hashtags;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground gap-1 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="text-sm">
          <span className="text-muted-foreground">Blueprint for </span>
          <span className="text-foreground font-medium">{ideaTitle}</span>
          <span className="text-muted-foreground"> · {trendName}</span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">

        {/* ── Concept ── */}
        <div className="post-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Concept</h4>
          </div>
          <p className="text-secondary-foreground">{blueprint.concept}</p>
        </div>

        {/* ── Script Outline ── */}
        <div className="post-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Script Outline</h4>
          </div>
          <ul className="space-y-2">
            {blueprint.script_outline.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-sm text-secondary-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Full Script (video only) ── */}
        {isVideo && blueprint.full_script && (
          <div className="post-card p-4">
            <button
              type="button"
              onClick={() => setScriptExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-2 mb-1"
            >
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Full Script</h4>
                <span className="text-xs text-muted-foreground font-normal">(voiceover / dialogue)</span>
              </div>
              {scriptExpanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {scriptExpanded && (
              <div className="mt-3 bg-secondary/50 rounded-lg p-3">
                <pre className="text-sm text-secondary-foreground whitespace-pre-wrap font-sans">
                  {blueprint.full_script}
                </pre>
              </div>
            )}
            {!scriptExpanded && (
              <p className="text-xs text-muted-foreground mt-1">Click to expand the full word-for-word script</p>
            )}
          </div>
        )}

        {/* ── Caption ── */}
        <div className="post-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Caption</h4>
            </div>
            <div className="flex items-center gap-2">
              {/* Short / Long tabs */}
              {blueprint.long_caption && (
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setCaptionTab("short")}
                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${captionTab === "short" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    <AlignLeft className="w-3 h-3" /> Short
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptionTab("long")}
                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${captionTab === "long" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    <AlignJustify className="w-3 h-3" /> Long
                  </button>
                </div>
              )}
              {/* Feedback */}
              {onFeedback && (
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-green-500 hover:bg-green-500/10" onClick={() => onFeedback({ outputType: "caption", newOutput: blueprint.caption, userFeedback: "love" })} title="Love this">
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10" onClick={() => onFeedback({ outputType: "caption", newOutput: blueprint.caption, userFeedback: "ok" })} title="It's okay">
                    <Meh className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={() => onFeedback({ outputType: "caption", newOutput: blueprint.caption, userFeedback: "dislike" })} title="Not a fan">
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-secondary/50 p-3 rounded-lg">
            {captionTab === "short" || !blueprint.long_caption ? (
              <p className="text-secondary-foreground whitespace-pre-wrap">{blueprint.caption}</p>
            ) : (
              <>
                <p className="text-secondary-foreground whitespace-pre-wrap">{blueprint.long_caption}</p>
                <p className="text-xs text-muted-foreground mt-2">Keyword-rich caption — optimised for discoverability</p>
              </>
            )}
          </div>
        </div>

        {/* ── Hashtags ── */}
        <div className="post-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Hashtags</h4>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOptimizeInline}
              disabled={optimizing}
              className="gap-1.5 text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
            >
              {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {optimizing ? "Optimising…" : optimizedHashtags ? "Re-optimise" : "Optimise"}
            </Button>
          </div>

          {trendHashtags && !optimizedHashtags && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">From trend data:</p>
              <p className="text-sm text-accent">{trendHashtags}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              {optimizedHashtags ? "Optimised suggestions:" : "AI suggested:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {displayHashtags.map((tag, index) => (
                <span key={index} className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Deep analysis nudge */}
          {onDeepHashtagAnalysis && (
            <p className="text-xs text-muted-foreground mt-3">
              Want competition data, volume scores & gap analysis?{" "}
              <button
                type="button"
                onClick={onDeepHashtagAnalysis}
                className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
              >
                Open Hashtag Analysis <ExternalLink className="w-3 h-3" />
              </button>
            </p>
          )}
        </div>

        {/* ── Pro Tips ── */}
        <div className="post-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-accent" />
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Pro Tips</h4>
          </div>
          <ul className="space-y-2">
            {blueprint.extra_tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span className="text-sm text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};
