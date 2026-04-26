import type { ZoomSequenceProps } from "@/components/CinematicHero/types";

export function ZoomSequence({ scrollProgress, isActive }: ZoomSequenceProps) {
  if (!isActive) return null;

  const scale = 1 + scrollProgress * 8;
  const opacity = Math.min(1, scrollProgress * 1.6);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute left-1/2 top-[58%] h-[34%] w-[56%] -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div
          className="h-full w-full border border-primary/70 bg-black/40 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
          style={{ clipPath: `inset(${8 - scrollProgress * 8}% ${10 - scrollProgress * 10}% round ${12 - scrollProgress * 12}px)` }}
        >
          <div className="absolute inset-0">
            {[
              "left-0 top-0 rotate-0",
              "right-0 top-0 rotate-90",
              "right-0 bottom-0 rotate-180",
              "left-0 bottom-0 -rotate-90",
            ].map((position) => (
              <svg key={position} className={`absolute h-8 w-8 text-primary ${position}`} viewBox="0 0 24 24" fill="none" style={{ opacity }} aria-hidden="true">
                <path d="M2 10V2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ))}
          </div>
        </div>
      </div>

      {scrollProgress > 0.86 && (
        <div className="absolute left-0 top-0 h-[2px] w-full bg-primary/40 shadow-[0_0_12px_4px_hsl(217_91%_60%)] animate-[scan-beam_0.25s_ease-out]" />
      )}
    </div>
  );
}
