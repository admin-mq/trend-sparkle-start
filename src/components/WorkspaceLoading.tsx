import { Play, Sparkles, FileText } from "lucide-react";
import { WorkspaceStep } from "./WorkspaceStepper";

interface WorkspaceLoadingProps {
  step: WorkspaceStep;
}

const loadingMessages: Record<WorkspaceStep, { icon: React.ElementType; message: string }> = {
  trends: { icon: Play, message: "Scanning today's trends…" },
  directions: { icon: Sparkles, message: "Cooking up ideas…" },
  blueprint: { icon: FileText, message: "Building your blueprint…" },
};

export const WorkspaceLoading = ({ step }: WorkspaceLoadingProps) => {
  const { icon: Icon, message } = loadingMessages[step];

  return (
    <div className="absolute inset-0 bg-card/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center loading-pulse">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin-slow" 
             style={{ borderTopColor: 'hsl(var(--primary))' }} />
      </div>
      <p className="mt-4 text-foreground font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
    </div>
  );
};
