import { useMemo, useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { SCROLL_PHASES } from "@/components/CinematicHero/constants";
import type { PhaseProgress, ScrollPhase } from "@/components/CinematicHero/types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Maps normalized scroll progress into cinematic phase buckets.
 */
export function useScrollPhase(containerRef: React.RefObject<HTMLElement | null>):
  PhaseProgress & { scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"] } {
  const boundaries = useMemo(
    () => [
      SCROLL_PHASES.PHASE_0_AMBIENT,
      SCROLL_PHASES.PHASE_1_PULL,
      SCROLL_PHASES.PHASE_2_LOCK,
      SCROLL_PHASES.PHASE_3_VORTEX,
      SCROLL_PHASES.PHASE_4_DASHBOARD,
    ],
    [],
  );

  const [phaseState, setPhaseState] = useState<PhaseProgress>({ phase: 0, progress: 0 });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const value = clamp01(latest);
    let nextPhase: ScrollPhase = 4;
    let nextProgress = 1;

    for (let i = 0; i < boundaries.length; i += 1) {
      const [start, end] = boundaries[i];
      if (value <= end || i === boundaries.length - 1) {
        nextPhase = i as ScrollPhase;
        nextProgress = clamp01((value - start) / (end - start || 1));
        break;
      }
    }

    setPhaseState((prev) =>
      prev.phase === nextPhase && Math.abs(prev.progress - nextProgress) < 0.001
        ? prev
        : { phase: nextPhase, progress: nextProgress },
    );
  });

  return { ...phaseState, scrollYProgress };
}
