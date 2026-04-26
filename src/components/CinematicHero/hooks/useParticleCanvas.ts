import { useEffect, useRef } from "react";
import { TIMINGS } from "@/components/CinematicHero/constants";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  done: boolean;
}

const PARTICLE_COUNT = 120;

/**
 * Drives a lightweight particle vortex animation on a canvas element.
 */
export function useParticleCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  onComplete: () => void,
) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onComplete();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const side = Math.floor(Math.random() * 4);
      const baseX = side < 2 ? (side === 0 ? 0 : width) : Math.random() * width;
      const baseY = side >= 2 ? (side === 2 ? 0 : height) : Math.random() * height;
      return {
        x: baseX,
        y: baseY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: 1 + Math.random() * 2,
        opacity: 0.9,
        done: false,
      };
    });

    const startedAt = performance.now();

    const frame = () => {
      const elapsed = performance.now() - startedAt;
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.clearRect(0, 0, width, height);
      ctx.restore();

      let completed = 0;
      for (const particle of particles) {
        if (particle.done) {
          completed += 1;
          continue;
        }

        const dx = centerX - particle.x;
        const dy = centerY - particle.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const acceleration = 0.045;

        particle.vx += (dx / distance) * acceleration;
        particle.vy += (dy / distance) * acceleration;
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (distance < 8) {
          particle.opacity -= 0.12;
          if (particle.opacity <= 0) {
            particle.done = true;
            completed += 1;
            continue;
          }
        }

        const t = Math.min(1, distance / Math.hypot(width, height));
        const hue = 199 + (217 - 199) * (1 - t);
        ctx.fillStyle = `hsla(${hue}, 91%, 60%, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (completed >= particles.length || elapsed > TIMINGS.vortexDurationMs + 200) {
        onComplete();
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      canvas.remove();
    };
  }, [canvasRef, enabled, onComplete]);
}
