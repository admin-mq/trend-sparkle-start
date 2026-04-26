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

export function AmbientScene({ scrollProgress, isActive }: AmbientSceneProps) {
  const bokehY = useTransform(scrollProgress, [0, 0.35], [0, 105]);
  const subjectY = useTransform(scrollProgress, [0, 0.35], [0, 35]);
  const textOpacity = useTransform(scrollProgress, [0, 0.15], [1, 0]);
  const vignetteOpacity = useTransform(scrollProgress, [0, 0.35], [0.2, 0.8]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div style={{ y: bokehY }} className="absolute inset-0">
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
          />
        </picture>
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

      <motion.div style={{ opacity: textOpacity }} className="absolute inset-0 flex items-center justify-center px-6">
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

      {!isActive && <div className="pointer-events-none absolute inset-0 bg-black/45 transition-opacity" />}
    </div>
  );
}
