export const SCROLL_PHASES = {
  PHASE_0_AMBIENT: [0, 0.15],
  PHASE_1_PULL: [0.15, 0.35],
  PHASE_2_LOCK: [0.35, 0.6],
  PHASE_3_VORTEX: [0.6, 0.8],
  PHASE_4_DASHBOARD: [0.8, 1],
} as const;

export const BREAKPOINTS = {
  mobileMax: 767,
} as const;

export const TIMINGS = {
  scanLineMs: 180,
  vortexDurationMs: 800,
  typewriterMs: 28,
} as const;

export const HERO_SCROLL_HEIGHT = "500vh";
