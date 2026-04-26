import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { AmbientScene } from "@/components/CinematicHero/phases/AmbientScene";
import { ZoomSequence } from "@/components/CinematicHero/phases/ZoomSequence";
import { DashboardReveal } from "@/components/CinematicHero/phases/DashboardReveal";
import { BREAKPOINTS, HERO_SCROLL_HEIGHT } from "@/components/CinematicHero/constants";
import { useScrollPhase } from "@/components/CinematicHero/hooks/useScrollPhase";

const TransitionVortex = lazy(async () => ({
  default: (await import("@/components/CinematicHero/phases/TransitionVortex")).TransitionVortex,
}));

/**
 * ASSET REQUIRED:
 * File: /public/assets/dashboard-preview-mobile.jpg
 * Description: Mobile dashboard screenshot at ~390px width for hero fallback.
 * Interim placeholder: Use https://placehold.co/780x1560/0f172a/334155
 */

export function CinematicHero() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const [vortexComplete, setVortexComplete] = useState(false);

  const { phase, scrollYProgress } = useScrollPhase(containerRef);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${BREAKPOINTS.mobileMax}px)`);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const href = "/assets/hero-woman-macbook.jpg";
    if (document.head.querySelector(`link[rel='preload'][href='${href}']`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  if (isMobile) {
    return <MobileFallback />;
  }

  return (
    <section ref={containerRef} className="relative" style={{ height: HERO_SCROLL_HEIGHT }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-background">
        <AmbientScene scrollProgress={scrollYProgress} isActive={phase <= 1} />

        {phase >= 1 && phase <= 2 && (
          <ZoomSequence
            scrollProgress={scrollYProgress}
            onLockComplete={() => setVortexComplete(false)}
            isMobile={isMobile}
          />
        )}

        <AnimatePresence>
          {phase === 3 && !vortexComplete && (
            <Suspense fallback={<div className="absolute inset-0 z-30 bg-black/40" />}>
              <TransitionVortex
                isActive={phase === 3}
                isMobile={isMobile || Boolean(prefersReducedMotion)}
                onComplete={() => setVortexComplete(true)}
              />
            </Suspense>
          )}
        </AnimatePresence>

        {phase >= 4 && <DashboardReveal scrollProgress={scrollYProgress} isVisible={phase >= 4} />}
      </div>
    </section>
  );
}

function MobileFallback() {
  const [missingHeroImage, setMissingHeroImage] = useState(false);
  const [missingDashboardImage, setMissingDashboardImage] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const dashboardOpacity = useTransform(scrollYProgress, [0.35, 0.7], [0, 1]);

  return (
    <section ref={sectionRef} className="relative bg-background px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        {!missingHeroImage ? (
          <picture>
            <source srcSet="/assets/hero-woman-macbook.webp" type="image/webp" />
            <img
              src="/assets/hero-woman-macbook.jpg"
              alt="A marketer working at a laptop using Marketers Quest"
              className="h-[48vh] w-full rounded-2xl object-cover object-top"
              width={900}
              height={1200}
              loading="eager"
              onError={() => setMissingHeroImage(true)}
            />
          </picture>
        ) : (
          <div className="h-[48vh] w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_20%,hsl(217_91%_60%_/_0.30),transparent_45%),linear-gradient(180deg,hsl(222_24%_11%)_0%,hsl(222_24%_6%)_100%)]" />
        )}

        {!missingDashboardImage ? (
          <motion.img
            style={{ opacity: dashboardOpacity }}
            src="/assets/dashboard-preview-mobile.jpg"
            alt="Marketers Quest mobile dashboard preview"
            className="h-[42vh] w-full rounded-2xl border border-white/10 object-cover"
            onError={() => setMissingDashboardImage(true)}
          />
        ) : (
          <motion.div
            style={{ opacity: dashboardOpacity }}
            className="h-[42vh] w-full rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950"
          />
        )}

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
