import { MQLogo } from "@/components/MQLogo";

export function CinematicHomepage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#0b1220_0%,#0a0f1c_48%,#070b14_100%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-20 top-20 h-[380px] w-[380px] rounded-full bg-cyan-400/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10 md:py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MQLogo size={30} showBackground />
            <span className="text-sm font-semibold tracking-wide text-white/90">Marketers Quest</span>
          </div>

          <div className="flex items-center gap-2">
            <a href="/auth" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10">
              Log in
            </a>
            <a href="/auth" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_10px_30px_rgba(59,130,246,0.35)] transition hover:opacity-95">
              Get Started
            </a>
          </div>
        </header>

        <section className="mx-auto mt-16 flex w-full max-w-3xl flex-col items-center text-center md:mt-20">
          <span className="mb-5 inline-flex rounded-full border border-primary/35 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.16em] text-primary">
            AI-Powered Marketing Platform
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
            Every Brand Deserves CMO-Grade Marketing
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/75 md:text-lg">
            Unify trend intelligence, PR execution, and SEO planning inside one premium growth workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/auth" className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_10px_30px_rgba(59,130,246,0.35)] transition hover:opacity-95">
              Start for Free →
            </a>
            <a href="/free-scan" className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              See Demo Preview
            </a>
          </div>
        </section>

        <section className="mx-auto mt-16 w-full max-w-5xl md:mt-20">
          <div className="rounded-[28px] border border-white/15 bg-slate-950/75 p-3 shadow-[0_28px_100px_rgba(0,0,0,0.62)] backdrop-blur-xl">
            <div className="rounded-[22px] border border-white/10 bg-black/70 p-3 md:p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/90" />
                <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-white/45">app.marketersquest.com/dashboard</span>
              </div>

              <div className="grid gap-3 md:grid-cols-[190px_1fr]">
                <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  {["Dashboard", "Trend Quest", "PR Campaigns", "SEO", "Influencers", "Analytics"].map((item, idx) => (
                    <div key={item} className={`mb-1 rounded-md px-2 py-2 text-xs ${idx === 0 ? "bg-primary/20 text-primary" : "text-white/65"}`}>
                      {item}
                    </div>
                  ))}
                </aside>

                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 md:p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ["Trend Score", "94", "+12"],
                      ["PR Mentions", "3,200", "+8%"],
                      ["SEO Position", "#4", "+2"],
                    ].map(([label, value, delta]) => (
                      <article key={label} className="rounded-lg border border-white/10 bg-black/40 p-3 text-left">
                        <p className="text-[11px] uppercase tracking-wide text-white/55">{label}</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
                        <p className="text-xs text-primary">{delta}</p>
                      </article>
                    ))}
                  </div>

                  <section className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-left">
                    <p className="mb-1 text-xs font-medium text-primary">Amcue AI CMO</p>
                    <p className="text-sm text-white/85">
                      #SustainableFashion is up 34% this week. Launch a PR push for lifestyle journalists and increase Thursday IG spend by 20%.
                    </p>
                  </section>

                  <div className="h-24 rounded-lg border border-white/10 bg-gradient-to-r from-primary/15 to-cyan-400/10" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default CinematicHomepage;
