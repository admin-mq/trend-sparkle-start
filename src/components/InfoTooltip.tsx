import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  /** Size of the icon in pixels (default 13) */
  size?: number;
  className?: string;
}

/**
 * A small ⓘ icon that reveals a plain-English explanation on hover.
 * Drop it next to any jargon label: <InfoTooltip text="What this means…" />
 */
export function InfoTooltip({ text, size = 13, className = "" }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors ${className}`}
            style={{ lineHeight: 1 }}
          >
            <Info style={{ width: size, height: size }} />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[220px] text-xs leading-relaxed text-center"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
