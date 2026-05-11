import {
  AlertCircle,
  Clock3,
  Users,
  Share2,
  BadgeDollarSign,
  Globe2,
  BarChart2,
  Bookmark,
  ChefHat,
  Banknote,
} from "lucide-react";

interface InsightCard {
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  bg: string;
}

const insightCards: InsightCard[] = [
  {
    title: "Why It Flopped",
    description: "See exactly what killed your underperforming post: hook, timing, topic, or the algorithm.",
    icon: AlertCircle,
    accent: "text-rose-500 dark:text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    title: "The Swipe Line",
    description: "The second viewers tapped away from your Reel. Fix the leak, keep the watch time.",
    icon: Clock3,
    accent: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    title: "Real Followers",
    description: "How many of your followers are actually alive, active, and watching you.",
    icon: Users,
    accent: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    title: "Who's Sharing You",
    description: "The fans quietly DM'ing your content to friends: your real growth engine.",
    icon: Share2,
    accent: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    title: "Know Your Worth",
    description: "What brands are paying creators just like you. Stop guessing your rate.",
    icon: BadgeDollarSign,
    accent: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Your Other Tribe",
    description: "Where else your audience hangs out: Threads, Facebook, WhatsApp.",
    icon: Globe2,
    accent: "text-cyan-500 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    title: "You vs. Them",
    description: "How you stack up against creators your size in your niche. No names, just numbers.",
    icon: BarChart2,
    accent: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    title: "Saves That Pay",
    description: "Which saved posts actually turned into clicks, visits, and sales.",
    icon: Bookmark,
    accent: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "Your Content Recipe",
    description: "The perfect mix of Reels, carousels, and stories: built for your goals.",
    icon: ChefHat,
    accent: "text-pink-500 dark:text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    title: "Your Money Mirror",
    description: "What creators your size are earning. See if you're leaving money on the table.",
    icon: Banknote,
    accent: "text-teal-500 dark:text-teal-400",
    bg: "bg-teal-500/10",
  },
];

const CreatorAnalytics = () => {
  return (
    <div className="min-h-full p-5 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Creator Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deep insights built for creators — understand your audience, content, and earning power.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {insightCards.map((card) => (
            <div
              key={card.title}
              className="relative rounded-xl border border-border bg-card p-5 flex flex-col gap-3 overflow-hidden"
            >
              {/* Coming Soon badge — top right */}
              <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                Coming Soon
              </span>

              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <card.icon className={`w-4.5 h-4.5 ${card.accent}`} style={{ width: 18, height: 18 }} />
              </div>

              {/* Text */}
              <div className="space-y-1 pr-16">
                <p className="text-sm font-semibold text-foreground leading-snug">{card.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default CreatorAnalytics;
