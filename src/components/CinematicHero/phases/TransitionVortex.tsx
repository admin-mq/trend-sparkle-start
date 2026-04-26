import { useEffect, useRef, useState } from "react";
import { useParticleCanvas } from "@/components/CinematicHero/hooks/useParticleCanvas";

interface TransitionVortexProps {
  isActive: boolean;
  onComplete: () => void;
  isMobile: boolean;
}

export function TransitionVortex({ isActive, onComplete, isMobile }: TransitionVortexProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setReady(false);
      return;
    }

    if (isMobile) {
      const timer = window.setTimeout(onComplete, 260);
      return () => window.clearTimeout(timer);
    }

    setReady(true);
  }, [isActive, isMobile, onComplete]);

  useParticleCanvas(canvasRef, isActive && ready && !isMobile, onComplete);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-40 bg-gradient-to-b from-black/40 to-background/80 transition-opacity duration-300">
      {!isMobile && <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />}
    </div>
  );
}
