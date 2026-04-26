import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useTransform } from "framer-motion";
import { TIMINGS } from "@/components/CinematicHero/constants";
import type { ZoomSequenceProps } from "@/components/CinematicHero/types";

export function ZoomSequence({ scrollProgress, onLockComplete, isMobile }: ZoomSequenceProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const scanTriggeredRef = useRef(false);
  const lockTriggeredRef = useRef(false);
  const [start, end] = [0.15, 0.6];

  const bracketOpacity = useTransform(scrollProgress, [0.15, 0.2, 0.55], [0, 1, 0]);
  const bracketScale = useTransform(scrollProgress, [0.15, 0.2], [1.1, 1]);
  const clipPath = useTransform(scrollProgress, [0.15, 0.6], ["inset(8% 10% round 12px)", "inset(0% 0% round 0px)"]);

  const [showScanLine, setShowScanLine] = useState(false);

  useEffect(() => {
    if (isMobile || !frameRef.current || !triggerRef.current) {
      return;
    }

    let mounted = true;
    let trigger: { kill: () => void } | undefined;

    (async () => {
      const gsapModule = await import("gsap");
      const scrollPlugin = await import("gsap/ScrollTrigger");
      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollPlugin.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      if (!mounted || !frameRef.current || !triggerRef.current) {
        return;
      }

      trigger = ScrollTrigger.create({
        trigger: triggerRef.current,
        start: "15% top",
        end: "60% top",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          gsap.set(frameRef.current, {
            scale: 1 + p * 7,
            xPercent: -24 * p,
            yPercent: -18 * p,
            transformOrigin: "50% 50%",
          });
        },
      });
    })();

    return () => {
      mounted = false;
      trigger?.kill();
    };
  }, [isMobile]);

  useMotionValueEvent(scrollProgress, "change", (latest) => {
    if (latest > 0.58 && !scanTriggeredRef.current) {
      scanTriggeredRef.current = true;
      setShowScanLine(true);
    }
    if (latest > 0.6 && !lockTriggeredRef.current) {
      lockTriggeredRef.current = true;
      onLockComplete();
    }
  });

  const brackets = useMemo(
    () => [
      "left-0 top-0 rotate-0",
      "right-0 top-0 rotate-90",
      "right-0 bottom-0 rotate-180",
      "left-0 bottom-0 -rotate-90",
    ],
    [],
  );

  return (
    <div ref={triggerRef} className="pointer-events-none absolute inset-0">
      <motion.div
        ref={frameRef}
        style={{ clipPath }}
        className="absolute left-[22%] top-[34%] h-[34%] w-[56%] border border-primary/60 bg-black/25 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
      >
        <motion.div style={{ opacity: bracketOpacity, scale: bracketScale }} className="absolute inset-0">
          {brackets.map((position) => (
            <svg key={position} className={`absolute h-8 w-8 text-primary ${position}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2 10V2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ))}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showScanLine && (
          <motion.div
            initial={{ y: 0, opacity: 0.9 }}
            animate={{ y: "100vh", opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TIMINGS.scanLineMs / 1000, ease: "easeOut" }}
            onAnimationComplete={() => setShowScanLine(false)}
            className="absolute left-0 top-0 h-[2px] w-full bg-primary/40 shadow-[0_0_12px_4px_hsl(217_91%_60%)]"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
