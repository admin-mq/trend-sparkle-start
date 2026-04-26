import { useState } from "react";
import { motion, useTransform } from "framer-motion";
import type { AmbientSceneProps } from "@/components/CinematicHero/types";

const subtitleWords = ["faster", "smarter", "with confidence"];

/**
 * ASSET REQUIRED:
 * File: /public/assets/hero-woman-macbook.jpg
 * Description: Studio photograph of a woman working on a MacBook Pro 14"
 *              Shot from a 35-40° angle, slight left-of-center composition.
 *              MacBook screen must be overexposed (near-white) so dashboard
 *              overlay composites naturally. Bokeh office background.
 *              Minimum resolution: 2400×1600px. Provide WebP + JPEG.
 * Interim placeholder: Use https://placehold.co/2400x1600/0f172a/334155
 */

function RotatingSubtitle() {
  return (
    <span className="inline-flex gap-2 text-base text-white/80 md:text-lg">
      Market with
      <span className="relative inline-flex h-7 w-32 overflow-hidden align-middle">
        {subtitleWords.map((word, index) => (
          <span
            key={word}
            className="absolute inset-0 animate-[rotate-word_9s_infinite]"
            style={{ animationDelay: `${index * 3}s` }}
          >
            {word}
          </span>
        ))}
      </span>
    </span>
  );
}

function PremiumFallbackScene() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(217_91%_60%_/_0.30),transparent_45%),radial-gradient(circle_at_80%_15%,hsl(199_89%_52%_/_0.20),transparent_40%),linear-gradient(180deg,hsl(222_24%_10%)_0%,hsl(222_24%_7%)_55%,hsl(222_24%_5%)_100%)]">
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute left-1/2 top-[57%] w-[min(68vw,820px)] -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-white/15 bg-slate-950/55 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="rounded-[20px] border border-white/10 bg-black/70 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/90" />
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Marketers Quest Workspace</span>
          </div>
          <div className="grid h-[220px] gap-2 md:grid-cols-[180px_1fr]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
              {["Dashboard", "Trend Quest", "PR", "SEO", "Analytics"].map((item, idx) => (
                <div
                  key={item}
                  className={`mb-1 rounded-md px-2 py-1.5 text-xs ${idx === 0 ? "bg-primary/20 text-primary" : "text-white/65"}`}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <div className="grid grid-cols-3 gap-2">
                {["94", "3.2k", "#4"].map((v) => (
                  <div key={v} className="rounded-lg border border-white/10 bg-black/45 p-2 text-center text-sm font-semibold text-white/90">
                    {v}
                  </div>
                ))}
              </div>
              <div className="h-24 rounded-lg border border-primary/20 bg-primary/10" />
              <div className="h-16 rounded-lg border border-white/10 bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AmbientScene({ scrollProgress, isActive }: AmbientSceneProps) {
  const [missingHeroImage, setMissingHeroImage] = useState(false);

  const bokehY = useTransform(scrollProgress, [0, 0.35], [0, 105]);
  const subjectY = useTransform(scrollProgress, [0, 0.35], [0, 35]);
  const textOpacity = useTransform(scrollProgress, [0, 0.15], [1, 0]);
  const vignetteOpacity = useTransform(scrollProgress, [0, 0.35], [0.2, 0.8]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <motion.div style={{ y: bokehY }} className="absolute inset-0">
        {!missingHeroImage ? (
          <picture>
            <source srcSet="/assets/hero-woman-macbook.webp" type="image/webp" />
            <img
              src="/assets/hero-woman-macbook.jpg"
              alt="A marketer working at a laptop using Marketers Quest"
              className="h-full w-full object-cover object-center"
              width={2400}
              height={1600}
              loading="eager"
              fetchPriority="high"
              onError={() => setMissingHeroImage(true)}
            />
          </picture>
        ) : (
          <PremiumFallbackScene />
        )}
      </motion.div>

      <motion.div style={{ y: subjectY }} className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      {Array.from({ length: 12 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/35 blur-[1px] animate-[float-card_8s_ease-in-out_infinite]"
          style={{ left: `${(index * 8) % 100}%`, top: `${(index * 11) % 100}%`, animationDelay: `${index * 0.35}s` }}
          aria-hidden="true"
        />
      ))}

      <motion.div style={{ opacity: textOpacity }} className="absolute inset-0 z-10 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-primary/40 bg-background/40 px-4 py-2 text-xs font-medium tracking-[0.16em] text-primary backdrop-blur-sm">
            AI-Powered Marketing Platform
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Every Brand Deserves CMO-Grade Marketing</h1>
          <div className="mt-4">
            <RotatingSubtitle />
          </div>
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: vignetteOpacity }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.85)_100%)]"
      />

      {!isActive && <div className="pointer-events-none absolute inset-0 bg-black/50 transition-opacity" />}
    </div>
  );
}
