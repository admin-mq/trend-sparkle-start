import type { AmbientSceneProps } from "@/components/CinematicHero/types";

const words = ["faster", "smarter", "with confidence"];

export function AmbientScene({ scrollProgress, isActive }: AmbientSceneProps) {
  const headlineOpacity = Math.max(0, 1 - scrollProgress * 5);
  const bgShift = scrollProgress * 60;

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 10%, rgba(59,130,246,0.24), transparent 45%), radial-gradient(1000px 540px at 86% 15%, rgba(34,211,238,0.18), transparent 42%), linear-gradient(180deg, #0b1220 0%, #0a0f1c 48%, #070b14 100%)",
          transform: `translateY(${bgShift * 0.3}px)`,
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/55 to-transparent" />

      <div className="absolute left-1/2 top-[66%] h-10 w-[72%] -translate-x-1/2 rounded-full bg-black/40 blur-2xl" />

      <div className="absolute left-1/2 top-[62%] h-[130px] w-[230px] -translate-x-[140%] -translate-y-1/2 rounded-t-[90px] rounded-b-[24px] bg-slate-700/60" />
      <div className="absolute left-[24%] top-[64%] h-[85px] w-[38px] rounded-full bg-slate-700/70" />
      <div className="absolute left-[31%] top-[62%] h-[95px] w-[38px] rounded-full bg-slate-700/70" />
      <div className="absolute left-[37%] top-[70%] h-[18px] w-[170px] rounded-2xl bg-slate-700/55" />
      <div className="absolute left-[35%] top-[73%] h-[12px] w-[190px] rounded-2xl bg-slate-800/65" />

      <div
        className="absolute left-1/2 top-[58%] w-[min(66vw,820px)] -translate-x-1/2 -translate-y-1/2"
        style={{ transform: `translate(-50%, -50%) scale(${1 + scrollProgress * 0.06})` }}
      >
        <div className="rounded-[26px] border border-white/15 bg-slate-950/70 p-3 shadow-[0_25px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl">
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
                  <div key={item} className={`mb-1 rounded-md px-2 py-1.5 text-xs ${idx === 0 ? "bg-primary/20 text-primary" : "text-white/65"}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Trend", "94"],
                    ["PR", "3.2k"],
                    ["SEO", "#4"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-white/10 bg-black/45 p-2 text-center">
                      <p className="text-[10px] text-white/60">{k}</p>
                      <p className="text-sm font-semibold text-white/90">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="h-24 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/20 to-cyan-400/15" />
                <div className="h-16 rounded-lg border border-white/10 bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.84)_100%)]" />

      <div className="absolute inset-0 z-20 flex items-center justify-center px-6" style={{ opacity: headlineOpacity }}>
        <div className="max-w-3xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-primary/40 bg-background/40 px-4 py-2 text-xs font-medium tracking-[0.16em] text-primary backdrop-blur-sm">
            AI-Powered Marketing Platform
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Every Brand Deserves CMO-Grade Marketing</h1>
          <p className="mt-4 text-base text-white/80 md:text-lg">
            Market with <span className="inline-block min-w-[150px]">{words[Math.floor((Date.now() / 2000) % words.length)]}</span>
          </p>
        </div>
      </div>

      {!isActive && <div className="pointer-events-none absolute inset-0 z-30 bg-black/45 transition-opacity" />}
    </div>
  );
}
