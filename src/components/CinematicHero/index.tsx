import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AmbientScene } from "@/components/CinematicHero/phases/AmbientScene";
import { ZoomSequence } from "@/components/CinematicHero/phases/ZoomSequence";
import { DashboardReveal } from "@/components/CinematicHero/phases/DashboardReveal";
import { BREAKPOINTS, HERO_SCROLL_HEIGHT } from "@/components/CinematicHero/constants";
import { useScrollPhase } from "@/components/CinematicHero/hooks/useScrollPhase";

const TransitionVortex = lazy(async () => ({
  default: (await import("@/components/CinematicHero/phases/TransitionVortex")).TransitionVortex,
}));

export function CinematicHero() {
  const containerRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const { phase, progress, overallProgress } = useScrollPhase(containerRef);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${BREAKPOINTS.mobileMax}px)`);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (isMobile) {
    return <MobileFallback />;
  }

  const isZoom = phase === 1 || phase === 2;
  const isVortex = phase === 3;
  const isDashboard = phase === 4;

  return (
    <section ref={containerRef} className="relative" style={{ height: HERO_SCROLL_HEIGHT }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-background">
        <AmbientScene scrollProgress={overallProgress} isActive={phase === 0 || phase === 1} />

        <ZoomSequence scrollProgress={progress} isActive={isZoom} />

        {isVortex && (
          <Suspense fallback={<div className="absolute inset-0 z-40 bg-black/50" />}>
            <TransitionVortex isActive={isVortex} isMobile={false} onComplete={() => undefined} />
          </Suspense>
        )}

        <DashboardReveal isVisible={isDashboard} revealProgress={isDashboard ? progress : 0} />
      </div>
    </section>
  );
}

function MobileFallback() {
  return (
    <section className="relative bg-background px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <div className="h-[48vh] w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_20%,hsl(217_91%_60%_/_0.30),transparent_45%),linear-gradient(180deg,hsl(222_24%_11%)_0%,hsl(222_24%_6%)_100%)]" />
        <div className="h-[42vh] w-full rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950" />

        <div className="space-y-3 overflow-x-auto snap-x snap-mandatory pb-2">
          {[
            ["Trend Score", "94"],
            ["PR Mentions", "3,200"],
            ["AI Insight", "#SustainableFashion +34%"],
          ].map(([title, value]) => (
            <article key={title} className="snap-start rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">{title}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </article>
          ))}
        </div>

        <a href="/auth" className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Start for Free →
        </a>
      </div>
    </section>
  );
}
