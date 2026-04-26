import { useEffect, useMemo, useState } from "react";
import { SCROLL_PHASES } from "@/components/CinematicHero/constants";
import type { PhaseProgress, ScrollPhase } from "@/components/CinematicHero/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function useScrollPhase(containerRef: React.RefObject<HTMLElement | null>): PhaseProgress {
  const [state, setState] = useState<PhaseProgress>({ phase: 0, progress: 0, overallProgress: 0 });

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

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const total = Math.max(1, rect.height - window.innerHeight);
      const scrolled = clamp01(-rect.top / total);

      let phase: ScrollPhase = 4;
      let progress = 1;
      for (let i = 0; i < boundaries.length; i += 1) {
        const [start, end] = boundaries[i];
        if (scrolled <= end || i === boundaries.length - 1) {
          phase = i as ScrollPhase;
          progress = clamp01((scrolled - start) / Math.max(end - start, 0.0001));
          break;
        }
      }

      setState((prev) =>
        prev.phase === phase && Math.abs(prev.progress - progress) < 0.002 && Math.abs(prev.overallProgress - scrolled) < 0.002
          ? prev
          : { phase, progress, overallProgress: scrolled },
      );
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [boundaries, containerRef]);

  return state;
}
