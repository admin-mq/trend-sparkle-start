import { TrendingUp, Lightbulb, FileText, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

// Trend Quest workspace navigation. The first three steps form the
// linear flow: pick a trend → pick a creative angle → generate a
// blueprint. The fourth, "saved_trends" / "My Trends", is a SIDE
// tab that surfaces 48h-TTL trend bookmarks the user clicked along
// the way. It's reachable any time after at least one trend has
// been recommended (so it never loads a blank tab) and visually
// separated from the linear group via a divider.
export type WorkspaceStep = "trends" | "directions" | "blueprint" | "saved_trends";

interface WorkspaceStepperProps {
  activeStep: WorkspaceStep;
  hasTrends: boolean;
  hasDirections: boolean;
  hasBlueprint: boolean;
  /**
   * True when the user has at least one un-expired saved trend. We
   * intentionally don't block the tab when count is zero — clicking
   * it should always work, the empty state lives inside the panel.
   * Wired separately so the parent can hint disabled state if it wants.
   */
  hasSavedTrends?: boolean;
  onStepClick: (step: WorkspaceStep) => void;
}

const linearSteps = [
  { id: "trends" as const,     label: "Trends",    icon: TrendingUp, num: 1 },
  { id: "directions" as const, label: "Ideas",     icon: Lightbulb,  num: 2 },
  { id: "blueprint" as const,  label: "Blueprint", icon: FileText,   num: 3 },
];

export const WorkspaceStepper = ({
  activeStep,
  hasTrends,
  hasDirections,
  hasBlueprint,
  hasSavedTrends = false,
  onStepClick,
}: WorkspaceStepperProps) => {
  const canClick = (stepId: WorkspaceStep) => {
    if (stepId === "trends") return hasTrends;
    if (stepId === "directions") return hasDirections;
    if (stepId === "blueprint") return hasBlueprint;
    // My Trends is always clickable — it has its own empty state.
    if (stepId === "saved_trends") return true;
    return false;
  };

  const getStepState = (stepId: WorkspaceStep) => {
    if (stepId === activeStep) return "active";
    if (canClick(stepId)) return "completed";
    return "pending";
  };

  const renderStep = (step: { id: WorkspaceStep; label: string; icon: typeof TrendingUp; num?: number }) => {
    const state = getStepState(step.id);
    const clickable = canClick(step.id);
    const Icon = step.icon;
    return (
      <button
        key={step.id}
        onClick={() => clickable && onStepClick(step.id)}
        disabled={!clickable && state !== "active"}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
          state === "active" && "step-active shadow-glow",
          state === "completed" && "step-completed hover:bg-secondary/80 cursor-pointer",
          state === "pending" && "step-pending cursor-not-allowed opacity-50"
        )}
      >
        {step.num !== undefined && (
          <span className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-xs",
            state === "active" && "bg-primary-foreground/20",
            state === "completed" && "bg-muted-foreground/20",
            state === "pending" && "bg-muted-foreground/10"
          )}>
            {step.num}
          </span>
        )}
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{step.label}</span>
        {/* Saved trends counter dot — purely visual. Real count lives
            inside the panel; here we just nudge the user that there's
            something parked behind this tab. */}
        {step.id === "saved_trends" && hasSavedTrends && state !== "active" && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        )}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-xl">
      {linearSteps.map(renderStep)}
      {/* Visual divider — the saved-trends tab is conceptually separate
          from the linear flow above. */}
      <div className="w-px h-6 bg-border/60 mx-1" aria-hidden="true" />
      {renderStep({ id: "saved_trends", label: "My Trends", icon: Bookmark })}
    </div>
  );
};
