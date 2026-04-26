import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParticleCanvas } from "@/components/CinematicHero/hooks/useParticleCanvas";

interface TransitionVortexProps {
  isActive: boolean;
  onComplete: () => void;
  isMobile: boolean;
}

export function TransitionVortex({ isActive, onComplete, isMobile }: TransitionVortexProps) {
  const prefersReducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setReady(false);
      return;
    }

    if (prefersReducedMotion || isMobile) {
      const timer = window.setTimeout(onComplete, 300);
      return () => window.clearTimeout(timer);
    }

    setReady(true);
  }, [isActive, isMobile, onComplete, prefersReducedMotion]);

  useParticleCanvas(canvasRef, isActive && ready && !prefersReducedMotion && !isMobile, onComplete);

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="absolute inset-0 z-30 bg-gradient-to-b from-black/40 to-background/80"
    >
      {!prefersReducedMotion && !isMobile && (
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
      )}
    </motion.div>
  );
}
