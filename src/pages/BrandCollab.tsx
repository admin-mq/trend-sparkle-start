const brands = [
  { name: "Red Bull",      bg: "#1a1a2e", text: "#c8102e", abbr: "Red Bull" },
  { name: "Gymshark",      bg: "#0d0d0d", text: "#00c4b4", abbr: "GYMSHARK" },
  { name: "Formula 1",     bg: "#e10600", text: "#ffffff", abbr: "F1" },
  { name: "Disney",        bg: "#003087", text: "#ffffff", abbr: "Disney" },
  { name: "Marvel",        bg: "#ec1d24", text: "#ffffff", abbr: "MARVEL" },
  { name: "Tinder",        bg: "#fd5564", text: "#ffffff", abbr: "tinder" },
  { name: "Nike",          bg: "#111111", text: "#ffffff", abbr: "NIKE" },
  { name: "Adidas",        bg: "#000000", text: "#ffffff", abbr: "adidas" },
  { name: "Spotify",       bg: "#191414", text: "#1db954", abbr: "Spotify" },
  { name: "Netflix",       bg: "#141414", text: "#e50914", abbr: "NETFLIX" },
  { name: "Coca‑Cola",     bg: "#f40000", text: "#ffffff", abbr: "Coca‑Cola" },
  { name: "Amazon",        bg: "#232f3e", text: "#ff9900", abbr: "amazon" },
  { name: "Apple",         bg: "#1d1d1f", text: "#f5f5f7", abbr: "Apple" },
  { name: "Puma",          bg: "#0a0a0a", text: "#ffffff", abbr: "PUMA" },
  { name: "Under Armour",  bg: "#1d1d1d", text: "#e31837", abbr: "UA" },
  { name: "Samsung",       bg: "#1428a0", text: "#ffffff", abbr: "SAMSUNG" },
  { name: "PlayStation",   bg: "#003087", text: "#ffffff", abbr: "PlayStation" },
  { name: "GoPro",         bg: "#111",    text: "#00adef", abbr: "GoPro" },
  { name: "Reebook",       bg: "#cc0000", text: "#ffffff", abbr: "Reebok" },
  { name: "Lululemon",     bg: "#6d2077", text: "#ffffff", abbr: "lululemon" },
];

export default function BrandCollab() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Blurred brand logo grid */}
      <div
        className="grid gap-4 p-8 select-none pointer-events-none"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          filter: "blur(6px)",
          opacity: 0.55,
        }}
      >
        {brands.map((brand) => (
          <div
            key={brand.name}
            className="rounded-2xl flex items-center justify-center"
            style={{
              backgroundColor: brand.bg,
              height: 110,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="font-black tracking-tight text-center px-3 leading-tight"
              style={{
                color: brand.text,
                fontSize: brand.abbr.length > 8 ? "1rem" : "1.35rem",
              }}
            >
              {brand.abbr}
            </span>
          </div>
        ))}
      </div>

      {/* Coming Soon overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-4 max-w-sm w-full rounded-2xl border border-border bg-background/90 backdrop-blur-md shadow-2xl p-8 flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Coming Soon
          </span>
          <h2 className="text-xl font-bold text-foreground leading-snug">
            Connect with Brands of your choice and negotiate offers.
          </h2>
          <p className="text-sm text-muted-foreground">
            Brand Collab is on its way. You'll be able to browse brand deals, pitch yourself, and manage negotiations — all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
