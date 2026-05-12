import { useEffect, useRef, useState } from "react";

const WELCOME_FLAG = "mq_show_creator_welcome";

export function shouldShowCreatorWelcome(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(WELCOME_FLAG) === "1";
}

export function markCreatorWelcomePending() {
  if (typeof window !== "undefined") localStorage.setItem(WELCOME_FLAG, "1");
}

export function clearCreatorWelcome() {
  if (typeof window !== "undefined") localStorage.removeItem(WELCOME_FLAG);
}

type Props = {
  onComplete: () => void;
  durationMs?: number;
};

function Word({ children, delay, className = "" }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-mq-word-in ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

type Sparkle = { id: number; left: number; top: number; delay: number; size: number };

function makeSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 1.5,
    size: 6 + Math.random() * 14,
  }));
}

export function CreatorWelcomeOverlay({ onComplete, durationMs = 5000 }: Props) {
  const [exiting, setExiting] = useState(false);
  const [sparkles] = useState(() => makeSparkles(28));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), durationMs - 450);
    const doneTimer = setTimeout(() => onCompleteRef.current(), durationMs);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [durationMs]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-background transition-opacity duration-500 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,153,0,0.18),transparent_60%)]" />

      <div className="absolute inset-0 pointer-events-none">
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="absolute block animate-mq-sparkle"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path
                d="M12 2l1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2z"
                fill="url(#mq-sparkle-grad)"
              />
              <defs>
                <linearGradient id="mq-sparkle-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFB347" />
                  <stop offset="100%" stopColor="#FF9900" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        ))}
      </div>

      <div
        className={`relative z-10 px-6 text-center transition-opacity duration-500 ease-out ${
          exiting ? "opacity-0" : "opacity-100"
        }`}
      >
        <p className="text-lg md:text-2xl font-medium text-foreground/80 tracking-tight">
          <Word delay={0}>Welcome</Word>{" "}
          <Word delay={220}>to</Word>{" "}
          <Word delay={440}>the</Word>
        </p>

        <div className="my-3 md:my-4 inline-flex flex-col items-center select-none animate-mq-glow">
          <Word delay={700} className="block">
            <span
              className="text-6xl md:text-8xl font-black tracking-tight leading-none text-foreground"
              style={{ fontFamily: '"Amazon Ember", "Helvetica Neue", Arial, sans-serif', letterSpacing: "-0.04em" }}
            >
              amazon
            </span>
          </Word>
          <svg
            viewBox="0 0 220 30"
            className="w-[78%] h-5 md:h-7 mt-1 animate-mq-arrow"
            aria-hidden="true"
          >
            <path
              d="M6 10 C 60 28, 160 28, 214 10"
              stroke="#FF9900"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M198 4 L 214 10 L 200 20"
              stroke="#FF9900"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <p className="text-[1.35rem] md:text-[1.8rem] font-medium text-foreground/80 tracking-tight">
          <Word delay={1500}>of</Word>{" "}
          <Word delay={1680}>successful</Word>{" "}
          <Word delay={1860} className="text-[#FF9900] font-semibold">content</Word>{" "}
          <Word delay={2040} className="text-[#FF9900] font-semibold">ideas</Word>
        </p>
      </div>

      <style>{`
        @keyframes mq-sparkle {
          0%   { transform: scale(0) rotate(0deg);   opacity: 0; }
          25%  { transform: scale(1) rotate(45deg);  opacity: 1; }
          60%  { transform: scale(0.8) rotate(120deg); opacity: 0.9; }
          100% { transform: scale(0) rotate(180deg); opacity: 0; }
        }
        .animate-mq-sparkle {
          animation: mq-sparkle 2.4s ease-in-out infinite;
          filter: drop-shadow(0 0 6px rgba(255,153,0,0.6));
        }
        @keyframes mq-glow {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(255,153,0,0.25)); }
          50%      { filter: drop-shadow(0 0 38px rgba(255,153,0,0.55)); }
        }
        .animate-mq-glow { animation: mq-glow 2.2s ease-in-out infinite; }
        @keyframes mq-arrow-draw {
          from { stroke-dasharray: 260; stroke-dashoffset: 260; }
          to   { stroke-dasharray: 260; stroke-dashoffset: 0; }
        }
        .animate-mq-arrow path {
          animation: mq-arrow-draw 0.9s ease-out 1s backwards;
        }
        @keyframes mq-word-in {
          0%   { opacity: 0; transform: translateY(14px) scale(0.92); filter: blur(4px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-mq-word-in {
          animation: mq-word-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards;
          will-change: opacity, transform, filter;
        }
      `}</style>
    </div>
  );
}
