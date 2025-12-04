import { Button } from "@/components/ui/button";
import { DetailedDirection } from "@/types/trends";
import { ArrowLeft, FileText, Hash, Lightbulb, Play, MessageSquare } from "lucide-react";

interface ExecutionBlueprintProps {
  trendName: string;
  ideaTitle: string;
  blueprint: DetailedDirection | null;
  trendHashtags: string;
  onBack: () => void;
}

export const ExecutionBlueprint = ({ trendName, ideaTitle, blueprint, trendHashtags, onBack }: ExecutionBlueprintProps) => {
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

  return (
    <div className="space-y-4 animate-fade-in">
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
      
      <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
        {/* Concept */}
        <div className="post-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Concept</h4>
          </div>
          <p className="text-secondary-foreground">{blueprint.concept}</p>
        </div>

        {/* Script Outline */}
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

        {/* Caption */}
        <div className="post-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Caption</h4>
          </div>
          <div className="bg-secondary/50 p-3 rounded-lg">
            <p className="text-secondary-foreground whitespace-pre-wrap">{blueprint.caption}</p>
          </div>
        </div>

        {/* Hashtags */}
        <div className="post-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Hashtags</h4>
          </div>
          
          {trendHashtags && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">From trend data:</p>
              <p className="text-sm text-accent">{trendHashtags}</p>
            </div>
          )}
          
          <div>
            <p className="text-xs text-muted-foreground mb-2">AI suggested:</p>
            <div className="flex flex-wrap gap-2">
              {blueprint.recommended_hashtags.map((tag, index) => (
                <span key={index} className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Extra Tips */}
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
