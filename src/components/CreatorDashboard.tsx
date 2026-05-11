import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Sparkles, Hash, ArrowRight,
  Bookmark, FileText, Zap, MapPin, Flame,
  Clock, Globe, DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type TrendMode = "global" | "regional" | "niche";

interface HotTrend {
  trend_id: string;
  trend_name: string;
  category?: string;
  virality_score?: number;
  timing?: string;
  region?: string;
}

interface CreatorStats {
  savedThisWeek: number;
  draftsThisMonth: number;
  totalSaved: number;
  pipelineSaved: number;
  pipelineDrafted: number;
  hotTrends: HotTrend[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GEO_TO_REGION: Record<string, string> = {
  // Countries — what users select from the dropdown
  "united states": "US", "united kingdom": "UK", "india": "IN",
  "australia": "AU", "canada": "CA", "new zealand": "NZ",
  // US state names — covers old "city, state" free-text entries
  "alabama": "US", "alaska": "US", "arizona": "US", "arkansas": "US",
  "california": "US", "colorado": "US", "connecticut": "US", "delaware": "US",
  "florida": "US", "georgia": "US", "hawaii": "US", "idaho": "US",
  "illinois": "US", "indiana": "US", "iowa": "US", "kansas": "US",
  "kentucky": "US", "louisiana": "US", "maine": "US", "maryland": "US",
  "massachusetts": "US", "michigan": "US", "minnesota": "US",
  "mississippi": "US", "missouri": "US", "montana": "US", "nebraska": "US",
  "nevada": "US", "ohio": "US", "oklahoma": "US", "oregon": "US",
  "pennsylvania": "US", "tennessee": "US", "texas": "US", "utah": "US",
  "vermont": "US", "virginia": "US", "wisconsin": "US", "wyoming": "US",
  "new york": "US", "new jersey": "US", "new mexico": "US",
  "north carolina": "US", "north dakota": "US", "south carolina": "US",
  "south dakota": "US", "west virginia": "US", "washington": "US",
  "new hampshire": "US", "rhode island": "US",
  // UK nations — covers old free-text entries
  "england": "UK", "scotland": "UK", "wales": "UK",
};

function geoToRegion(geography?: string | null): string | null {
  if (!geography) return null;
  const lower = geography.toLowerCase().trim();
  // Exact match (new users with country dropdown)
  if (GEO_TO_REGION[lower]) return GEO_TO_REGION[lower];
  // Split "city, state" or "city, country" on commas and check each part
  const parts = lower.split(",").map(p => p.trim());
  for (const part of parts) {
    if (GEO_TO_REGION[part]) return GEO_TO_REGION[part];
  }
  return null;
}

const REGION_LABELS: Record<string, string> = {
  IN: "India", UK: "United Kingdom", US: "United States",
  CA: "Canada", AU: "Australia", NZ: "New Zealand",
};

const CREATOR_GREETINGS: ((name: string, niche: string) => string)[] = [
  (n, ni) => `${ni} creators who post on trending topics get 3× more reach. Time to ride the wave, ${n}.`,
  (n)     => `The algorithm rewards consistency. Today's a great day to post, ${n}.`,
  (n, ni) => `Your audience is waiting for your take on what's trending in ${ni}. Let's give it to them, ${n}.`,
  (n)     => `Every viral post started with one creator who moved first. Move first today, ${n}.`,
  (n, ni) => `${ni} is trending. You are the expert. Put the two together, ${n}.`,
  (n)     => `Content without a trend is a whisper. Content on a trend is a megaphone. Use yours, ${n}.`,
  (n)     => `The best time to post on a trend is early. The second best time is right now, ${n}.`,
];

function getDailyCreatorGreeting(name: string, niche: string): string {
  const today = new Date().toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  return CREATOR_GREETINGS[Math.abs(hash) % CREATOR_GREETINGS.length](name, niche);
}

function getDateLine(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  }).toUpperCase();
}

function weekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const TIMING_CONFIG = {
  early:     { label: "Early Signal", icon: Zap,   cls: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  peaking:   { label: "Peaking Now",  icon: Flame, cls: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10" },
  saturated: { label: "Saturated",    icon: Clock, cls: "text-muted-foreground border-border bg-muted" },
};

// ── Trend fetching with progressive fallback ──────────────────────────────────

// Maps creator niches to the DB category labels that fetch-trends actually stores
const NICHE_TO_CATEGORIES: Record<string, string[]> = {
  fashion:       ["Fashion", "Lifestyle", "Entertainment", "Culture"],
  lifestyle:     ["Lifestyle", "Entertainment", "Culture", "Fashion"],
  beauty:        ["Fashion", "Lifestyle", "Entertainment"],
  fitness:       ["Sports", "Lifestyle", "Health"],
  health:        ["Lifestyle", "Health", "Sports"],
  food:          ["Lifestyle", "Entertainment", "Culture"],
  travel:        ["Lifestyle", "Culture", "Entertainment"],
  tech:          ["Tech", "Science", "AI", "Entertainment"],
  finance:       ["Finance", "News", "Business"],
  gaming:        ["Gaming", "Entertainment", "Tech"],
  music:         ["Music", "Entertainment", "Culture"],
  sports:        ["Sports", "Entertainment"],
  news:          ["News", "Politics", "Culture"],
  business:      ["Finance", "News", "Business", "Entrepreneurship"],
  entertainment: ["Entertainment", "Culture", "Music"],
  education:     ["Education", "News", "Science"],
  parenting:     ["Lifestyle", "Culture", "News"],
  pets:          ["Lifestyle", "Entertainment"],
};

function nicheToDbCategories(niche: string): string[] {
  const lower = niche.toLowerCase().trim();
  // Direct lookup first
  for (const [key, cats] of Object.entries(NICHE_TO_CATEGORIES)) {
    if (lower.includes(key)) return cats;
  }
  // Fallback: use niche word itself + Lifestyle + Entertainment
  return [niche, "Lifestyle", "Entertainment"];
}

function extractNicheKeywords(niche: string): string[] {
  return niche
    .split(/\s+and\s+|[,&]/i)
    .map(k => k.trim())
    .filter(k => k.length > 2);
}

async function fetchHotTrends(
  regionCode: string | null,
  niche: string | null
): Promise<{ data: HotTrend[]; mode: TrendMode }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const baseQuery = () =>
    supabase
      .from("trends")
      .select("trend_id, trend_name, category, virality_score, timing, region")
      .eq("active", true)
      .eq("premium_only", false)
      .gte("last_seen_at", since)
      .order("virality_score", { ascending: false })
      .limit(3);

  const nicheFilter = (q: ReturnType<typeof baseQuery>) => {
    if (!niche) return q;
    // Map creator niche to actual DB category labels (trends table uses
    // "Lifestyle", "Entertainment", etc. — not raw niche words like "fashion")
    const dbCategories = nicheToDbCategories(niche);
    const orFilter = dbCategories.map(c => `category.ilike.%${c}%`).join(",");
    return q.or(orFilter);
  };

  // 1. Niche + region (best match)
  if (regionCode && niche) {
    const { data } = await nicheFilter(baseQuery().eq("region", regionCode));
    if (data && data.length > 0) return { data: data as HotTrend[], mode: "niche" };
  }

  // 2. Niche only — any region (creator's niche > creator's region)
  if (niche) {
    const { data } = await nicheFilter(baseQuery());
    if (data && data.length > 0) return { data: data as HotTrend[], mode: "niche" };
  }

  // 3. Region only (no niche data available)
  if (regionCode) {
    const { data } = await baseQuery().eq("region", regionCode);
    if (data && data.length > 0) return { data: data as HotTrend[], mode: "regional" };
  }

  // 4. Global fallback (profile not filled)
  const { data } = await baseQuery();
  return { data: (data as HotTrend[]) ?? [], mode: "global" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CreatorDashboard = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuthContext();
  const [stats, setStats] = useState<CreatorStats>({
    savedThisWeek: 0, draftsThisMonth: 0, totalSaved: 0,
    pipelineSaved: 0, pipelineDrafted: 0, hotTrends: [],
  });
  const [loading, setLoading] = useState(true);
  const [trendMode, setTrendMode] = useState<TrendMode>("global");

  const creatorName = profile?.full_name || profile?.brand_name || "Creator";
  const niche = profile?.industry || "Content";
  const geography = (profile as any)?.location as string | undefined;
  const region = geoToRegion(geography);
  const regionLabel = region ? REGION_LABELS[region] ?? geography : geography;

  // Follower / audience size — stored in audience_size or similar field
  // Use a reasonable display if available
  const audienceSize = (profile as any)?.audience_size as string | undefined;

  const greeting = getDailyCreatorGreeting(creatorName, niche);

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const monday = weekStart().toISOString();
    const monthBegin = monthStart().toISOString();
    const now = new Date().toISOString();

    // Use the actual profile niche — null means "no profile filled" → global fallback
    const industryFilter = profile?.industry ?? null;

    const [savedWeekRes, draftsMonthRes, totalSavedRes, pipelineSavedRes, hotTrendsResult] =
      await Promise.all([
        // Saved this week
        supabase
          .from("user_saved_trends")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("saved_at", monday),

        // Drafts this month
        supabase
          .from("tweet_drafts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", monthBegin),

        // Total saved (all-time, non-expired)
        supabase
          .from("user_saved_trends")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gt("expires_at", now),

        // Pipeline: active saved trends
        supabase
          .from("user_saved_trends")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gt("expires_at", now),

        // Top 3 trends — filtered by region+niche if known, with progressive fallback
        fetchHotTrends(region, industryFilter),
      ]);

    // Drafts count — tweet_drafts groups 3 drafts per generation_id,
    // so count unique generation_ids for a meaningful "sessions" number
    const draftsThisMonth = draftsMonthRes.count ?? 0;

    setTrendMode(hotTrendsResult.mode);
    setStats({
      savedThisWeek:   savedWeekRes.count   ?? 0,
      draftsThisMonth: Math.ceil(draftsThisMonth / 3), // 3 drafts per generation
      totalSaved:      totalSavedRes.count  ?? 0,
      pipelineSaved:   pipelineSavedRes.count ?? 0,
      pipelineDrafted: Math.ceil(draftsThisMonth / 3),
      hotTrends:       hotTrendsResult.data,
    });
    setLoading(false);
  }, [user, region, profile?.industry]);

  useEffect(() => { void loadData(); }, [loadData]);

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("bg-secondary animate-pulse rounded-lg", className)} />
  );

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const statCards = [
    {
      label: "Trends saved this week",
      value: stats.savedThisWeek,
      icon: Bookmark,
      accent: "text-primary",
      bg: "bg-primary/10",
      path: "/trend-quest",
    },
    {
      label: "Drafts created this month",
      value: stats.draftsThisMonth,
      icon: FileText,
      accent: "text-violet-500 dark:text-violet-400",
      bg: "bg-violet-500/10",
      path: "/tweet-drafts",
    },
    {
      label: "Saved trends (active)",
      value: stats.totalSaved,
      icon: TrendingUp,
      accent: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      path: "/trend-quest",
    },
  ];

  // ── Quick actions ───────────────────────────────────────────────────────────
  const quickActions = [
    {
      label: "Find Trends",
      description: "Discover what's trending in your niche",
      path: "/trend-quest",
      icon: TrendingUp,
      cta: "Open Trend Quest",
    },
    {
      label: "Draft a Post",
      description: "Turn saved trends into ready-to-post content",
      path: "/tweet-drafts",
      icon: Sparkles,
      cta: "Open My Drafts",
    },
    {
      label: "Hashtag Analysis",
      description: "Find the best hashtags for your next post",
      path: "/hashtag-analysis",
      icon: Hash,
      cta: "Analyse Hashtags",
    },
    {
      label: "Brand Collab",
      description: "Connect with brands for paid partnerships",
      path: "/brand-collab",
      icon: DollarSign,
      cta: "Coming Soon",
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-full p-5 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── 1. Hero ────────────────────────────────────────────────────── */}
        <div className="briefing-card p-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
            {getDateLine()} · Creator Intelligence Briefing
          </p>
          {loading
            ? <><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></>
            : <h1 className="text-xl lg:text-2xl font-bold leading-snug text-foreground max-w-3xl">
                {greeting}
              </h1>
          }
          {/* Platform focus badge row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {niche && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {niche}
              </span>
            )}
            {regionLabel && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
                <MapPin className="w-3 h-3" />{regionLabel}
              </span>
            )}
            {audienceSize && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
                {audienceSize} followers
              </span>
            )}
          </div>
        </div>

        {/* ── 2. Stat strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {loading
            ? [1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)
            : statCards.map(card => (
              <button
                key={card.label}
                onClick={() => navigate(card.path)}
                className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/3 transition-all group space-y-2"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
                  <card.icon className={cn("w-4 h-4", card.accent)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                    {card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{card.label}</p>
                </div>
              </button>
            ))
          }
        </div>

        {/* ── 3. What's hot in [region] ──────────────────────────────────── */}
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-amber-500/4 to-transparent p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {trendMode === "niche" && regionLabel
                  ? `Top ${niche} trends in ${regionLabel}`
                  : trendMode === "regional" && regionLabel
                  ? `What's trending in ${regionLabel}`
                  : "What's trending on the internet right now"}
              </span>
            </div>
            <button
              onClick={() => navigate("/trend-quest")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all trends <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : stats.hotTrends.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <Globe className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Trend data is being fetched. Check back in a few minutes.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/trend-quest")}
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <TrendingUp className="w-3 h-3" /> Go to Trend Quest
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.hotTrends.map((trend, i) => {
                const timing = trend.timing as keyof typeof TIMING_CONFIG | undefined;
                const timingCfg = timing ? TIMING_CONFIG[timing] : null;
                const bar = trend.virality_score ?? 0;
                const barColor = bar >= 80 ? "bg-emerald-500" : bar >= 60 ? "bg-amber-500" : "bg-primary";

                return (
                  <div
                    key={trend.trend_id}
                    onClick={() => navigate("/trend-quest")}
                    className="flex items-center gap-3 bg-background/60 rounded-lg px-4 py-3 cursor-pointer hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-muted-foreground/50 w-4 flex-shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {trend.trend_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {trend.category && (
                          <span className="text-[11px] text-muted-foreground">{trend.category}</span>
                        )}
                        {trend.region && trend.category && (
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                        )}
                        {trend.region && (
                          <span className="text-[10px] font-medium px-1 py-0 rounded bg-secondary text-muted-foreground">
                            {REGION_LABELS[trend.region] ?? trend.region}
                          </span>
                        )}
                      </div>
                    </div>
                    {timingCfg && (
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0",
                        timingCfg.cls
                      )}>
                        <timingCfg.icon className="w-2.5 h-2.5" />
                        {timingCfg.label}
                      </span>
                    )}
                    {bar > 0 && (
                      <div className="w-16 flex-shrink-0">
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${bar}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground text-right tabular-nums mt-0.5">{bar}</p>
                      </div>
                    )}
                    <ArrowRight className="w-3 h-3 text-transparent group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 4. Content pipeline ────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Content Pipeline</h2>
          <div className="grid grid-cols-3 gap-3">

            {/* Saved trends */}
            <button
              onClick={() => navigate("/trend-quest")}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bookmark className="w-3.5 h-3.5 text-primary" />
                </div>
                <ArrowRight className="w-3 h-3 text-transparent group-hover:text-primary transition-colors" />
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                {loading ? "—" : stats.pipelineSaved}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Saved trends</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">active · expires in 48h</p>
            </button>

            {/* Drafts */}
            <button
              onClick={() => navigate("/tweet-drafts")}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-violet-500/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                </div>
                <ArrowRight className="w-3 h-3 text-transparent group-hover:text-violet-500 transition-colors" />
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                {loading ? "—" : stats.pipelineDrafted}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Drafts created</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">this month</p>
            </button>

            {/* Published — Coming Soon */}
            <div className="relative rounded-xl border border-border bg-card p-4 overflow-hidden">
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                  Coming Soon
                </span>
              </div>
              <div className="opacity-40 pointer-events-none">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">—</p>
                <p className="text-xs text-muted-foreground mt-1">Published</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">connect your accounts</p>
              </div>
            </div>

          </div>
        </div>

        {/* ── 5. Quick actions ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => !action.comingSoon && navigate(action.path)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-all group space-y-3",
                  action.comingSoon
                    ? "border-border opacity-60 cursor-not-allowed"
                    : "border-border hover:border-primary/40 hover:bg-primary/3 cursor-pointer"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <action.icon className="w-4 h-4 text-primary" />
                  </div>
                  {action.comingSoon ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      Soon
                    </span>
                  ) : (
                    <ArrowRight className="w-3 h-3 text-transparent group-hover:text-primary transition-colors" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {action.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {action.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
