export type ScrollPhase = 0 | 1 | 2 | 3 | 4;

export interface PhaseProgress {
  phase: ScrollPhase;
  progress: number;
  overallProgress: number;
}

export interface PhaseComponentBaseProps {
  scrollProgress: number;
}

export interface AmbientSceneProps extends PhaseComponentBaseProps {
  isActive: boolean;
}

export interface ZoomSequenceProps extends PhaseComponentBaseProps {
  isActive: boolean;
}

export interface DashboardRevealProps {
  isVisible: boolean;
  revealProgress: number;
}
