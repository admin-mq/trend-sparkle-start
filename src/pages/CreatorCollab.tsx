const creators = [
  { handle: "@mrbeast",         platform: "YouTube",   followers: "340M", color: "#ff0000", bg: "#1a0000" },
  { handle: "@khaby.lame",      platform: "TikTok",    followers: "162M", color: "#69c9d0", bg: "#010101" },
  { handle: "@charlidamelio",   platform: "TikTok",    followers: "155M", color: "#fe2c55", bg: "#1a0008" },
  { handle: "@cristiano",       platform: "Instagram", followers: "640M", color: "#e1306c", bg: "#1a0010" },
  { handle: "@kyliejenner",     platform: "Instagram", followers: "399M", color: "#e1306c", bg: "#1a0010" },
  { handle: "@zachking",        platform: "TikTok",    followers: "80M",  color: "#69c9d0", bg: "#010101" },
  { handle: "@emma chamberlain",platform: "YouTube",   followers: "12M",  color: "#ff0000", bg: "#1a0000" },
  { handle: "@daviddobrik",     platform: "YouTube",   followers: "18M",  color: "#ff0000", bg: "#1a0000" },
  { handle: "@addisonre",       platform: "TikTok",    followers: "88M",  color: "#fe2c55", bg: "#1a0008" },
  { handle: "@markiplier",      platform: "YouTube",   followers: "37M",  color: "#ff0000", bg: "#1a0000" },
  { handle: "@loganpaul",       platform: "YouTube",   followers: "23M",  color: "#ff0000", bg: "#1a0000" },
  { handle: "@lelepons",        platform: "Instagram", followers: "50M",  color: "#e1306c", bg: "#1a0010" },
  { handle: "@dude_perfect",    platform: "YouTube",   followers: "60M",  color: "#ff0000", bg: "#1a0000" },
  { handle: "@spencerx",        platform: "TikTok",    followers: "76M",  color: "#69c9d0", bg: "#010101" },
  { handle: "@jamescharles",    platform: "Instagram", followers: "23M",  color: "#e1306c", bg: "#1a0010" },
  { handle: "@bretmanrock",     platform: "Instagram", followers: "18M",  color: "#e1306c", bg: "#1a0010" },
  { handle: "@nastya",          platform: "YouTube",   followers: "107M", color: "#ff0000", bg: "#1a0000" },
  { handle: "@prestonplayz",    platform: "YouTube",   followers: "18M",  color: "#ff0000", bg: "#1a0000" },
  { handle: "@avani",           platform: "TikTok",    followers: "42M",  color: "#fe2c55", bg: "#1a0008" },
  { handle: "@bellapoarch",     platform: "TikTok",    followers: "93M",  color: "#69c9d0", bg: "#010101" },
];

export default function CreatorCollab() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Blurred creator handle grid */}
      <div
        className="grid gap-4 p-8 select-none pointer-events-none"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          filter: "blur(6px)",
          opacity: 0.5,
        }}
      >
        {creators.map((c) => (
          <div
            key={c.handle}
            className="rounded-2xl flex flex-col items-center justify-center gap-1.5 px-3"
            style={{
              backgroundColor: c.bg,
              height: 110,
              border: `1px solid ${c.color}33`,
            }}
          >
            <span
              className="font-bold text-sm text-center leading-tight"
              style={{ color: c.color }}
            >
              {c.handle}
            </span>
            <span className="text-[10px] text-white/40 font-medium">{c.platform}</span>
            <span className="text-xs font-semibold text-white/70">{c.followers} followers</span>
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
            One collab. Double the reach. Ten times the impact.
          </h2>
          <p className="text-sm text-muted-foreground">
            Find creators who share your audience, pitch a collab idea, and make content that neither of you could go viral with alone. Your next million views starts with the right partner.
          </p>
        </div>
      </div>
    </div>
  );
}
