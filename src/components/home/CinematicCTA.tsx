interface CinematicCTAProps {
  title: string;
  description: string;
  href?: string;
  label?: string;
}

export function CinematicCTA({
  title,
  description,
  href = "/auth",
  label = "Start free",
}: CinematicCTAProps) {
  return (
    <section className="rounded-3xl border border-primary/20 bg-primary/10 px-8 py-12 text-center">
      <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{description}</p>
      <a
        href={href}
        className="mt-8 inline-flex rounded-full border border-primary/40 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
      >
        {label}
      </a>
    </section>
  );
}
