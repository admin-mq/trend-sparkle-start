import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useTransform } from "framer-motion";
import type { DashboardRevealProps } from "@/components/CinematicHero/types";
import { TIMINGS } from "@/components/CinematicHero/constants";

const INSIGHT = `#SustainableFashion volume is up 34% this week. Recommend launching a PR campaign targeting lifestyle journalists and boosting Instagram spend by 20% on Thursdays.`;

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const normalized = points.map((value, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 24 - ((value - min) / Math.max(max - min, 1)) * 20;
    return `${x},${y}`;
  });

  return (
    <svg viewBox="0 0 100 24" className="h-8 w-full" aria-hidden="true">
      <polyline fill="none" stroke="hsl(217 91% 60%)" strokeWidth="2" points={normalized.join(" ")} />
    </svg>
  );
}

export function DashboardReveal({ isVisible, scrollProgress }: DashboardRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const [typedInsight, setTypedInsight] = useState(prefersReducedMotion ? INSIGHT : "");
  const [cursorVisible, setCursorVisible] = useState(true);

  const shellOpacity = useTransform(scrollProgress, [0.75, 0.9], [0.2, 1]);

  useEffect(() => {
    if (!isVisible || prefersReducedMotion) {
      setTypedInsight(INSIGHT);
      return;
    }

    setTypedInsight("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedInsight(INSIGHT.slice(0, index));
      if (index >= INSIGHT.length) {
        window.clearInterval(timer);
      }
    }, TIMINGS.typewriterMs);

    return () => window.clearInterval(timer);
  }, [isVisible, prefersReducedMotion]);

  useEffect(() => {
    const blink = window.setInterval(() => setCursorVisible((prev) => !prev), 500);
    return () => window.clearInterval(blink);
  }, []);

  const metricData = useMemo(
    () => [
      { title: "Trend Score", value: "94", delta: "+12", points: [12, 14, 16, 15, 18, 20, 22, 23] },
      { title: "PR Mentions", value: "3,200", delta: "+8%", points: [7, 8, 11, 10, 13, 16, 18, 20] },
      { title: "SEO Position", value: "#4", delta: "+2", points: [3, 4, 6, 8, 11, 15, 17, 20] },
    ],
    [],
  );

  return (
    <motion.section
      style={{ opacity: shellOpacity }}
      role="region"
      aria-label="Marketers Quest dashboard preview"
      className="absolute inset-0 z-20 flex items-center justify-center px-4 py-6 md:px-10"
    >
      <div className="w-full max-w-6xl overflow-hidden rounded-xl border border-white/10 bg-[hsl(222_24%_10%)] shadow-[inset_0_0_60px_rgba(59,130,246,0.05)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="ml-4 rounded-md bg-white/5 px-3 py-1 text-xs text-white/70">app.marketersquest.com/dashboard</div>
        </div>

        <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[14rem_1fr]">
          <AnimatePresence>
            {isVisible && (
              <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="border-r border-white/10 p-4">
                <div className="mb-4 text-sm font-semibold">Marketers Quest</div>
                {["Dashboard", "Trends", "SEO", "PR", "Influencers", "Analytics"].map((item, idx) => (
                  <motion.button
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className={`mb-1 block w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      item === "Dashboard"
                        ? "border-l-2 border-primary bg-primary/10 text-primary"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {item}
                  </motion.button>
                ))}
              </motion.aside>
            )}
          </AnimatePresence>

          <main className="space-y-4 p-4 md:p-6">
            <div className="grid gap-3 md:grid-cols-3">
              {metricData.map((metric, idx) => (
                <motion.article
                  key={metric.title}
                  aria-label={`${metric.title}: ${metric.value}, up ${metric.delta}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ amount: 0.3, once: true }}
                  transition={{ delay: 0.2 + idx * 0.08, duration: 0.4 }}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 transition hover:scale-[1.02] hover:border-primary"
                >
                  <p className="text-xs uppercase tracking-wide text-white/60">{metric.title}</p>
                  <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
                  <p className="text-xs text-primary">{metric.delta}</p>
                  <Sparkline points={metric.points} />
                </motion.article>
              ))}
            </div>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="rounded-lg border border-primary/20 bg-primary/5 p-4"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                Amcue AI CMO
              </div>
              <p className="text-sm text-white/85" aria-live="polite">
                {typedInsight}
                {cursorVisible && <span className="text-primary">|</span>}
              </p>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <p className="mb-3 text-sm text-white/80">Trend Score — Last 30 days</p>
              <svg viewBox="0 0 320 100" className="h-24 w-full" aria-hidden="true">
                <motion.path
                  d="M4,86 C46,76 74,36 112,42 C156,49 184,64 218,44 C250,25 276,32 316,12"
                  fill="none"
                  stroke="hsl(199 89% 52%)"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={isVisible ? { pathLength: 1 } : {}}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
            </motion.section>
          </main>
        </div>
      </div>
    </motion.section>
  );
}
