import { TrendingUp, Lightbulb, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceStep = "trends" | "directions" | "blueprint";

interface WorkspaceStepperProps {
  activeStep: WorkspaceStep;
  hasTrends: boolean;
  hasDirections: boolean;
  hasBlueprint: boolean;
  onStepClick: (step: WorkspaceStep) => void;
}

const steps = [
  { id: "trends" as const, label: "Trends", icon: TrendingUp, num: 1 },
  { id: "directions" as const, label: "Ideas", icon: Lightbulb, num: 2 },
  { id: "blueprint" as const, label: "Blueprint", icon: FileText, num: 3 },
];

export const WorkspaceStepper = ({ 
  activeStep, 
  hasTrends, 
  hasDirections, 
  hasBlueprint,
  onStepClick 
}: WorkspaceStepperProps) => {
  const canClick = (stepId: WorkspaceStep) => {
    if (stepId === "trends") return hasTrends;
    if (stepId === "directions") return hasDirections;
    if (stepId === "blueprint") return hasBlueprint;
    return false;
  };

  const getStepState = (stepId: WorkspaceStep) => {
    if (stepId === activeStep) return "active";
    if (canClick(stepId)) return "completed";
    return "pending";
  };

  return (
    <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-xl">
      {steps.map((step, index) => {
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
            <span className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-xs",
              state === "active" && "bg-primary-foreground/20",
              state === "completed" && "bg-muted-foreground/20",
              state === "pending" && "bg-muted-foreground/10"
            )}>
              {step.num}
            </span>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
};
