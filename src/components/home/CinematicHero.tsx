import { ArrowRight } from "lucide-react";

interface CinematicHeroProps {
  title: string;
  subtitle: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
}

export function CinematicHero({
  title,
  subtitle,
  primaryCtaLabel = "Get Started",
  primaryCtaHref = "/auth",
}: CinematicHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-background to-primary/10 px-8 py-20 md:px-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,theme(colors.primary.DEFAULT/.15),transparent_45%)]" />

      <div className="relative z-10 max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Cinematic concept</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{title}</h1>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">{subtitle}</p>

        <a
          href={primaryCtaHref}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {primaryCtaLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
