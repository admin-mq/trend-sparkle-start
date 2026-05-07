import { Button } from "@/components/ui/button";
import { CreativeDirection } from "@/types/trends";
import { Lightbulb, ArrowLeft, ArrowRight, Video, Heart, Meh, ThumbsDown, Briefcase, Users, Sparkles } from "lucide-react";

const ANCHOR_META: Record<
  NonNullable<CreativeDirection["brand_anchor"]>,
  { label: string; Icon: typeof Briefcase; classes: string }
> = {
  industry: {
    label: "On-industry",
    Icon: Briefcase,
    classes: "bg-primary/15 text-primary border-primary/30",
  },
  audience: {
    label: "Audience-relevant",
    Icon: Users,
    classes: "bg-accent/15 text-accent border-accent/30",
  },
  general: {
    label: "Cultural take",
    Icon: Sparkles,
    classes: "bg-secondary/40 text-secondary-foreground border-border",
  },
};

interface CreativeDirectionsProps {
  trendName: string;
  directions: CreativeDirection[];
  onViewBlueprint: (direction: CreativeDirection) => void;
  onBack: () => void;
  onFeedback?: (params: { outputType: "hook"; newOutput: string; userFeedback: "love" | "ok" | "dislike" }) => void;
}

export const CreativeDirections = ({ trendName, directions, onViewBlueprint, onBack, onFeedback }: CreativeDirectionsProps) => {
  if (directions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <Lightbulb className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No ideas yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Select a trend to generate creative directions.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
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
          <h3 className="text-sm text-muted-foreground">
            Ideas for <span className="text-foreground font-medium">{trendName}</span>
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">{directions.length} ideas</span>
      </div>
      
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {directions.map((direction, index) => (
          <div key={direction.idea_id} className="post-card p-4 hover:shadow-glow transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h4 className="font-semibold text-foreground">{direction.title}</h4>
                  {direction.brand_anchor && ANCHOR_META[direction.brand_anchor] && (() => {
                    const meta = ANCHOR_META[direction.brand_anchor];
                    return (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${meta.classes}`}
                        title={direction.anchor_rationale || meta.label}
                      >
                        <meta.Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-sm text-secondary-foreground mt-2">{direction.summary}</p>
                {direction.anchor_rationale && direction.brand_anchor && direction.brand_anchor !== "general" && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Why it fits: {direction.anchor_rationale}
                  </p>
                )}
              </div>
            </div>
            
            <div className="hook-highlight mt-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm italic text-foreground flex-1">
                  "{direction.hook}"
                </p>
                {onFeedback && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                      onClick={() => onFeedback({ outputType: "hook", newOutput: direction.hook, userFeedback: "love" })}
                      title="Love this hook"
                    >
                      <Heart className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10"
                      onClick={() => onFeedback({ outputType: "hook", newOutput: direction.hook, userFeedback: "ok" })}
                      title="It's okay"
                    >
                      <Meh className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => onFeedback({ outputType: "hook", newOutput: direction.hook, userFeedback: "dislike" })}
                      title="Not a fan"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 mt-3">
              <Video className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{direction.visual_idea}</p>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-accent font-medium">
                CTA: {direction.suggested_cta}
              </p>
              <Button 
                onClick={() => onViewBlueprint(direction)}
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary hover:bg-primary/10 gap-1"
              >
                Build blueprint
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
