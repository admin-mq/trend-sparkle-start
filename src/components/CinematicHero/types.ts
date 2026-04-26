import type { MotionValue } from "framer-motion";

export type ScrollPhase = 0 | 1 | 2 | 3 | 4;

export interface PhaseProgress {
  phase: ScrollPhase;
  progress: number;
}

export interface PhaseComponentBaseProps {
  scrollProgress: MotionValue<number>;
}

export interface AmbientSceneProps extends PhaseComponentBaseProps {
  isActive: boolean;
}

export interface ZoomSequenceProps extends PhaseComponentBaseProps {
  onLockComplete: () => void;
  isMobile: boolean;
}

export interface DashboardRevealProps extends PhaseComponentBaseProps {
  isVisible: boolean;
}
