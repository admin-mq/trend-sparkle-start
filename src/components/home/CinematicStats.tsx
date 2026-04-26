interface CinematicStat {
  label: string;
  value: string;
}

interface CinematicStatsProps {
  stats: CinematicStat[];
}

export function CinematicStats({ stats }: CinematicStatsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur"
        >
          <p className="text-3xl font-semibold tracking-tight text-primary">{stat.value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
        </article>
      ))}
    </section>
  );
}
