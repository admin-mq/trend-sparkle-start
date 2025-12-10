import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreativeDirection } from "@/types/trends";
import { Lightbulb, ArrowLeft, ArrowRight, Video, Lock, Crown } from "lucide-react";

interface CreativeDirectionsProps {
  trendName: string;
  directions: CreativeDirection[];
  onViewBlueprint: (direction: CreativeDirection) => void;
  onBack: () => void;
  isLocked?: boolean;
}

export const CreativeDirections = ({ trendName, directions, onViewBlueprint, onBack, isLocked = false }: CreativeDirectionsProps) => {
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
    <div className="space-y-4 animate-fade-in">
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
      
      <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
        {directions.map((direction, index) => (
          <div key={direction.idea_id} className="post-card p-4 hover:shadow-glow transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">{direction.title}</h4>
                <p className="text-sm text-secondary-foreground mt-2">{direction.summary}</p>
              </div>
            </div>
            
            <div className="hook-highlight mt-3">
              <p className="text-sm italic text-foreground">
                "{direction.hook}"
              </p>
            </div>

            <div className="flex items-start gap-2 mt-3">
              <Video className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{direction.visual_idea}</p>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-accent font-medium">
                CTA: {direction.suggested_cta}
              </p>
              {isLocked ? (
                <Link to="/auth">
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    Upgrade to Pro
                    <Crown className="w-3 h-3" />
                  </Button>
                </Link>
              ) : (
                <Button 
                  onClick={() => onViewBlueprint(direction)}
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary hover:bg-primary/10 gap-1"
                >
                  Build blueprint
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
