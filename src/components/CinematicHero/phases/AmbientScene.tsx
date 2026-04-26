import type { AmbientSceneProps } from "@/components/CinematicHero/types";

const words = ["faster", "smarter", "with confidence"];

export function AmbientScene({ scrollProgress, isActive }: AmbientSceneProps) {
  const headlineOpacity = Math.max(0, 1 - scrollProgress * 4.6);
  const bgShift = scrollProgress * 60;
  const laptopOpacity = Math.max(0.55, 0.78 - scrollProgress * 0.12);

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

      <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/60 to-transparent" />

      <div className="absolute left-1/2 top-[78%] h-10 w-[72%] -translate-x-1/2 rounded-full bg-black/40 blur-2xl" />

      <div className="absolute left-1/2 top-[74%] h-[120px] w-[220px] -translate-x-[135%] -translate-y-1/2 rounded-t-[88px] rounded-b-[22px] bg-slate-700/56" />
      <div className="absolute left-[25%] top-[76%] h-[78px] w-[34px] rounded-full bg-slate-700/65" />
      <div className="absolute left-[31%] top-[74%] h-[90px] w-[35px] rounded-full bg-slate-700/65" />
      <div className="absolute left-[37%] top-[81%] h-[16px] w-[160px] rounded-2xl bg-slate-700/50" />
      <div className="absolute left-[36%] top-[83%] h-[10px] w-[178px] rounded-2xl bg-slate-800/60" />

      <div
        className="absolute left-1/2 top-[76%] w-[min(62vw,760px)] -translate-x-1/2 -translate-y-1/2"
        style={{ transform: `translate(-50%, -50%) scale(${1 + scrollProgress * 0.04})`, opacity: laptopOpacity }}
      >
        <div className="rounded-[24px] border border-white/15 bg-slate-950/70 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.62)] backdrop-blur-xl">
          <div className="rounded-[18px] border border-white/10 bg-black/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/90" />
              <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Marketers Quest Workspace</span>
            </div>
            <div className="grid h-[198px] gap-2 md:grid-cols-[170px_1fr]">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                {[
                  "Dashboard",
                  "Trend Quest",
                  "PR",
                  "SEO",
                  "Analytics",
                ].map((item, idx) => (
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
                <div className="h-20 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/20 to-cyan-400/15" />
                <div className="h-14 rounded-lg border border-white/10 bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.84)_100%)]" />

      <div className="absolute inset-x-0 top-[16%] z-30 px-6" style={{ opacity: headlineOpacity }}>
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-5 inline-flex rounded-full border border-primary/40 bg-background/40 px-4 py-2 text-xs font-medium tracking-[0.16em] text-primary backdrop-blur-sm">
            AI-Powered Marketing Platform
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Every Brand Deserves CMO-Grade Marketing
          </h1>
          <p className="mt-4 text-base text-white/80 md:text-lg">
            Market with <span className="inline-block min-w-[150px]">{words[Math.floor((Date.now() / 2000) % words.length)]}</span>
          </p>
          <a href="/auth" className="mt-7 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
            Start for Free →
          </a>
        </div>
      </div>

      {!isActive && <div className="pointer-events-none absolute inset-0 z-40 bg-black/50 transition-opacity" />}
    </div>
  );
}
