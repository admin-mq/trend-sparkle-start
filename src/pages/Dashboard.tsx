import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search, TrendingUp, Zap, Globe, ArrowRight,
  Loader2, CheckCircle2, XCircle, AlertCircle,
  Megaphone, Users, BarChart3, Brain, Sparkles, Activity,
  Hash, TrendingDown, Minus, Trophy, FlaskConical, Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SiteRow { id: string; site_url: string; }

interface SnapshotRow {
  id: string;
  site_id: string;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
}

interface SitePerf {
  siteId: string;
  siteUrl: string;
  snapshotId: string;
  opportunity: number;
  structural: number;
  pagesCrawled: number;
  finishedAt: string | null;
}

interface RecentScan {
  snapshotId: string;
  siteUrl: string;
  status: string | null;
  startedAt: string | null;
}

interface DashData {
  sitesCount: number;
  scansCount: number;
  pagesCrawled: number;
  actionsCount: number;
  sitePerf: SitePerf[];
  recentScans: RecentScan[];
}

interface Insight {
  icon: React.ElementType;
  label: string;
  headline: string;
  detail: string;
  accent: string;
  iconBg: string;
}

interface TopAction {
  icon: React.ElementType;
  label: string;
  headline: string;
  detail: string;
  path: string;
  cta: string;
}

// ── Greeting Engine ───────────────────────────────────────────────────────────

const GREETINGS: ((brand: string) => string)[] = [
  (b) => `Every empire started with a single bold decision. Today, ${b} writes its next chapter.`,
  (b) => `The market doesn't wait. But ${b} doesn't follow — it leads.`,
  (b) => `Behind every great campaign is a brand that knew its story. Today, ${b} tells its.`,
  (b) => `The best marketing doesn't feel like marketing. Today, ${b} makes it feel inevitable.`,
  (b) => `Attention is the new currency. ${b} just walked into the room.`,
  (b) => `Some brands talk about impact. ${b} is here to create it.`,
  (b) => `A great day for marketing starts with clarity. ${b}, today is that day.`,
  (b) => `The world's most powerful brands were built one bold move at a time. ${b}, your move.`,
  (b) => `Intelligence without action is just noise. ${b} is here to act.`,
  (b) => `In a world full of campaigns, ${b} builds movements.`,
  (b) => `Markets shift. Algorithms change. But a brand with a clear voice always cuts through. ${b} has that voice.`,
  (b) => `The difference between a good campaign and a legendary one is one insight. ${b} finds it here.`,
];

function getDailyGreeting(brand: string): string {
  const today = new Date().toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  return GREETINGS[Math.abs(hash) % GREETINGS.length](brand);
}

function getDateLine(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  }).toUpperCase();
}

// ── AI Insight Generator ──────────────────────────────────────────────────────

function generateInsights(data: DashData): Insight[] {
  const insights: Insight[] = [];

  // Insight 1: SEO / Opportunity
  if (data.sitePerf.length > 0) {
    const topSite = data.sitePerf[0];
    const lowScorers = data.sitePerf.filter(s => s.opportunity < 50);
    insights.push({
      icon: TrendingUp,
      label: "SEO Opportunity",
      headline: lowScorers.length > 0
        ? `${lowScorers.length} site${lowScorers.length > 1 ? "s" : ""} with significant upside`
        : `${topSite.siteUrl.replace(/^https?:\/\//, "")} leads at ${topSite.opportunity} score`,
      detail: lowScorers.length > 0
        ? "Addressing low-scoring pages could meaningfully shift your brand's search presence"
        : "Your top site is well-optimised. Focus next on structural improvements.",
      accent: "border-blue-500/30",
      iconBg: "bg-blue-500/10 text-blue-400",
    });
  } else {
    insights.push({
      icon: TrendingUp,
      label: "SEO Opportunity",
      headline: "Run your first scan to unlock insights",
      detail: "Discover hidden opportunities across your brand's digital footprint",
      accent: "border-blue-500/30",
      iconBg: "bg-blue-500/10 text-blue-400",
    });
  }

  // Insight 2: Actions
  if (data.actionsCount > 0) {
    insights.push({
      icon: Zap,
      label: "Open Actions",
      headline: `${data.actionsCount} recommendation${data.actionsCount > 1 ? "s" : ""} ready to act on`,
      detail: "Each resolved action strengthens your brand's competitive position in search",
      accent: "border-amber-500/30",
      iconBg: "bg-amber-500/10 text-amber-400",
    });
  } else {
    insights.push({
      icon: Zap,
      label: "Open Actions",
      headline: "No pending actions — you're clear",
      detail: "Keep scanning regularly to stay ahead of new opportunities",
      accent: "border-emerald-500/30",
      iconBg: "bg-emerald-500/10 text-emerald-400",
    });
  }

  // Insight 3: Portfolio coverage
  insights.push({
    icon: Globe,
    label: "Brand Coverage",
    headline: data.sitesCount > 0
      ? `Monitoring ${data.sitesCount} domain${data.sitesCount > 1 ? "s" : ""} · ${data.pagesCrawled.toLocaleString()} pages`
      : "No domains tracked yet",
    detail: data.scansCount > 0
      ? `${data.scansCount} intelligence scan${data.scansCount > 1 ? "s" : ""} completed across your portfolio`
      : "Add your first domain to begin building brand intelligence",
    accent: "border-primary/30",
    iconBg: "bg-primary/10 text-primary",
  });

  return insights;
}

// ── Top Action Generator ──────────────────────────────────────────────────────

function getTopAction(data: DashData): TopAction {
  if (data.sitesCount === 0) {
    return {
      icon: Search,
      label: "First Step",
      headline: "Launch your first brand intelligence scan",
      detail: "Scan your website to unlock SEO insights, competitor gaps, and content opportunities tailored to your brand.",
      path: "/seo",
      cta: "Run Scan",
    };
  }

  if (data.actionsCount > 10) {
    const topSite = data.sitePerf[0];
    return {
      icon: Zap,
      label: "High Priority",
      headline: `${data.actionsCount} open recommendations need your attention`,
      detail: topSite
        ? `Start with ${topSite.siteUrl.replace(/^https?:\/\//, "")} — it has the highest opportunity score and will deliver the most impact fastest.`
        : "Review your open recommendations to maximise brand performance.",
      path: topSite ? `/seo/results?snapshot=${topSite.snapshotId}` : "/seo",
      cta: "View Recommendations",
    };
  }

  if (data.sitePerf.length > 0) {
    const lowestOpp = [...data.sitePerf].sort((a, b) => a.opportunity - b.opportunity)[0];
    return {
      icon: TrendingUp,
      label: "Growth Opportunity",
      headline: `${lowestOpp.siteUrl.replace(/^https?:\/\//, "")} has untapped SEO potential`,
      detail: `With an opportunity score of ${lowestOpp.opportunity}, this site has room to grow. A targeted content and technical push could shift rankings significantly.`,
      path: `/seo/results?snapshot=${lowestOpp.snapshotId}`,
      cta: "View Site Report",
    };
  }

  return {
    icon: Brain,
    label: "Explore Intelligence",
    headline: "Discover what's trending in your industry",
    detail: "Use Trend Quest to find rising topics and get AI-powered content directions specific to your brand audience.",
    path: "/trend-quest",
    cta: "Explore Trends",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isRecent(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function parseNotes(notes: string | null) {
  try {
    const obj = JSON.parse(notes || "{}");
    return {
      opportunity: Math.round(obj.avg_scores?.opportunity ?? 0),
      structural: Math.round(obj.avg_scores?.structural ?? 0),
      pagesCrawled: obj.pages_crawled ?? 0,
    };
  } catch { return { opportunity: 0, structural: 0, pagesCrawled: 0 }; }
}

// ── Hashtag Momentum ──────────────────────────────────────────────────────────

interface HashtagMomentum {
  totalAnalyses:    number;
  thisWeekCount:    number;
  thisWeekAvgScore: number | null;
  lastWeekAvgScore: number | null;
  scoreDelta:       number | null;       // positive = improved
  safeWins:         number;
  expWins:          number;
  bestWin: {
    caption:    string;
    metric:     number;                  // views
    metricType: "views" | "saves";
    multiplier: number | null;           // vs user avg, e.g. 2.1
    setChosen:  "safe" | "experimental";
  } | null;
}

async function loadHashtagMomentum(userId: string): Promise<HashtagMomentum | null> {
  try {
    const now    = new Date();
    // Monday 00:00 of current week
    const day    = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(monday.getTime() - 7 * 86_400_000);

    // Fetch last 60 days of requests + results + outcomes
    const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("hashtag_requests")
      .select(`
        id, created_at, caption,
        hashtag_results ( set_score ),
        hashtag_outcomes ( views, saves, shares, set_chosen )
      `)
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data) return null;
    if (data.length === 0) return null;

    type Row = {
      id: string; created_at: string; caption: string;
      hashtag_results: { set_score: number }[] | { set_score: number } | null;
      hashtag_outcomes: { views: number|null; saves: number|null; shares: number|null; set_chosen: string|null }[] | { views: number|null; saves: number|null; shares: number|null; set_chosen: string|null } | null;
    };

    const getResult  = (r: Row) => Array.isArray(r.hashtag_results)  ? r.hashtag_results[0]  : r.hashtag_results;
    const getOutcome = (r: Row) => Array.isArray(r.hashtag_outcomes) ? r.hashtag_outcomes[0] : r.hashtag_outcomes;

    const thisWeekRows  = (data as Row[]).filter(r => new Date(r.created_at) >= monday);
    const lastWeekRows  = (data as Row[]).filter(r => {
      const d = new Date(r.created_at);
      return d >= lastMonday && d < monday;
    });

    const avgScore = (rows: Row[]) => {
      const scores = rows.map(r => getResult(r)?.set_score).filter((s): s is number => s != null);
      return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    };

    const thisWeekAvg = avgScore(thisWeekRows);
    const lastWeekAvg = avgScore(lastWeekRows);
    const delta = (thisWeekAvg != null && lastWeekAvg != null) ? thisWeekAvg - lastWeekAvg : null;

    // Set win counts from outcomes
    let safeWins = 0, expWins = 0;
    for (const row of data as Row[]) {
      const o = getOutcome(row);
      if (o?.set_chosen === "safe")         safeWins++;
      else if (o?.set_chosen === "experimental") expWins++;
    }

    // Best win: row with highest views that has outcome data
    const withViews = (data as Row[])
      .map(r => ({ r, o: getOutcome(r) }))
      .filter(({ o }) => o?.views != null && o.views > 0)
      .sort((a, b) => (b.o!.views! - a.o!.views!));

    let bestWin: HashtagMomentum["bestWin"] = null;
    if (withViews.length > 0) {
      const { r, o } = withViews[0];
      const allViews = withViews.map(x => x.o!.views!);
      const avgViews = allViews.reduce((a, b) => a + b, 0) / allViews.length;
      const multiplier = allViews.length >= 2
        ? Math.round((o!.views! / avgViews) * 10) / 10
        : null;
      bestWin = {
        caption:    r.caption,
        metric:     o!.views!,
        metricType: "views",
        multiplier: multiplier && multiplier > 1.1 ? multiplier : null,
        setChosen:  (o!.set_chosen as "safe" | "experimental") ?? "safe",
      };
    }

    return {
      totalAnalyses:    data.length,
      thisWeekCount:    thisWeekRows.length,
      thisWeekAvgScore: thisWeekAvg,
      lastWeekAvgScore: lastWeekAvg,
      scoreDelta:       delta,
      safeWins,
      expWins,
      bestWin,
    };
  } catch (e) {
    console.error("loadHashtagMomentum error:", e);
    return null;
  }
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-6 text-right">{value}</span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [momentum, setMomentum] = useState<HashtagMomentum | null>(null);

  const brandName = profile?.brand_name || profile?.full_name || "Your Brand";
  const greeting = getDailyGreeting(brandName);

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: sites } = await (supabase as any)
      .from("scc_sites").select("id, site_url").eq("user_id", user.id);

    if (!sites?.length) {
      setData({ sitesCount: 0, scansCount: 0, pagesCrawled: 0, actionsCount: 0, sitePerf: [], recentScans: [] });
      setLoading(false);
      return;
    }

    const siteIds = sites.map((s: SiteRow) => s.id);
    const siteMap: Record<string, string> = {};
    sites.forEach((s: SiteRow) => { siteMap[s.id] = s.site_url; });

    const { data: allSnaps } = await (supabase as any)
      .from("scc_snapshots")
      .select("id, site_id, status, started_at, finished_at, notes")
      .in("site_id", siteIds)
      .order("started_at", { ascending: false, nullsFirst: false });

    const snaps: SnapshotRow[] = allSnaps || [];

    const { data: jobs } = await (supabase as any)
      .from("scc_crawl_jobs").select("pages_done").in("site_id", siteIds).eq("status", "completed");

    const pagesCrawled = (jobs || []).reduce(
      (sum: number, j: { pages_done: number }) => sum + (j.pages_done || 0), 0
    );

    const completedSnaps = snaps.filter(s => s.status === "completed");
    const latestPerSite: Record<string, SnapshotRow> = {};
    for (const snap of completedSnaps) {
      if (!latestPerSite[snap.site_id]) latestPerSite[snap.site_id] = snap;
    }
    const latestSnapIds = Object.values(latestPerSite).map(s => s.id);

    let actionsCount = 0;
    if (latestSnapIds.length > 0) {
      const { count } = await (supabase as any)
        .from("scc_actions").select("id", { count: "exact", head: true }).in("snapshot_id", latestSnapIds);
      actionsCount = count || 0;
    }

    const sitePerf: SitePerf[] = Object.values(latestPerSite).map(snap => {
      const { opportunity, structural, pagesCrawled: pc } = parseNotes(snap.notes);
      return {
        siteId: snap.site_id, siteUrl: siteMap[snap.site_id] || snap.site_id,
        snapshotId: snap.id, opportunity, structural, pagesCrawled: pc, finishedAt: snap.finished_at,
      };
    }).sort((a, b) => b.opportunity - a.opportunity);

    const recentScans: RecentScan[] = snaps.slice(0, 10).map(snap => ({
      snapshotId: snap.id, siteUrl: siteMap[snap.site_id] || snap.site_id,
      status: snap.status, startedAt: snap.started_at,
    }));

    setData({ sitesCount: sites.length, scansCount: snaps.length, pagesCrawled, actionsCount, sitePerf, recentScans });
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadHashtagMomentum(user.id).then(setMomentum);
    });
  }, []);

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("bg-secondary animate-pulse rounded-lg", className)} />
  );

  const insights = data ? generateInsights(data) : [];
  const topAction = data ? getTopAction(data) : null;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!loading && data?.sitesCount === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-5 max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            Run your first brand intelligence scan to unlock your full dashboard.
          </p>
          <Button onClick={() => navigate("/seo")} className="gap-2">
            <Search className="w-4 h-4" /> Run Your First Scan
          </Button>
        </div>
      </div>
    );
  }

  const toolkit = [
    { label: "SEO Intelligence", path: "/seo", icon: Search, description: "Scan any website for opportunities" },
    { label: "Trend Discovery", path: "/trend-quest", icon: TrendingUp, description: "AI-powered trend recommendations" },
    { label: "PR Campaigns", path: "/pr", icon: Megaphone, description: "Build and manage PR narratives" },
    { label: "Influencer Hub", path: "/influencers", icon: Users, description: "Manage your influencer network" },
    { label: "Analytics", path: "/analytics", icon: BarChart3, description: "Deep-dive brand performance" },
    { label: "Amcue AI CMO", path: "/amcue", icon: Brain, description: "Your always-on marketing advisor" },
  ];

  return (
    <div className="min-h-full p-5 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── 1. Briefing Hero ──────────────────────────────────────────── */}
        <div className="briefing-card p-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
            {getDateLine()} · Brand Intelligence Briefing
          </p>
          {loading
            ? <><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></>
            : <h1 className="text-2xl lg:text-3xl font-bold leading-snug text-foreground max-w-3xl">{greeting}</h1>
          }
          <p className="text-sm text-muted-foreground pt-1">
            Here's your marketing intelligence overview for today.
          </p>
        </div>

        {/* ── 2. AI Insight Cards ───────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-4">
          {loading
            ? [1, 2, 3].map(i => <Skeleton key={i} className="h-36" />)
            : insights.map((insight) => (
              <div
                key={insight.label}
                className={cn(
                  "rounded-xl border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors",
                  insight.accent
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", insight.iconBg)}>
                    <insight.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {insight.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {insight.headline}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {insight.detail}
                </p>
              </div>
            ))
          }
        </div>

        {/* ── 3. Hashtag Intelligence Momentum ─────────────────────────── */}
        {momentum && momentum.totalAnalyses > 0 && (
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-5 space-y-4">

            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                  Hashtag Intelligence · This Week
                </span>
              </div>
              <button
                onClick={() => navigate("/hashtag-analysis")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Analyse a post <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Stat strip */}
            <div className="grid grid-cols-3 gap-3">

              {/* Posts optimised this week */}
              <div className="bg-background/60 rounded-lg p-3.5 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Optimised This Week
                </p>
                <div className="flex items-end gap-1.5">
                  <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                    {momentum.thisWeekCount}
                  </span>
                  <span className="text-xs text-muted-foreground pb-0.5">
                    {momentum.thisWeekCount === 1 ? "post" : "posts"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {momentum.totalAnalyses} total all-time
                </p>
              </div>

              {/* Score trend */}
              <div className="bg-background/60 rounded-lg p-3.5 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Avg Readiness Score
                </p>
                <div className="flex items-end gap-1.5">
                  {momentum.thisWeekAvgScore != null ? (
                    <>
                      <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                        {momentum.thisWeekAvgScore}
                      </span>
                      {momentum.scoreDelta != null && momentum.scoreDelta !== 0 && (
                        <div className={cn(
                          "flex items-center gap-0.5 pb-0.5 text-xs font-semibold",
                          momentum.scoreDelta > 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {momentum.scoreDelta > 0
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />
                          }
                          {momentum.scoreDelta > 0 ? "+" : ""}{momentum.scoreDelta} pts
                        </div>
                      )}
                      {momentum.scoreDelta === 0 && (
                        <div className="flex items-center gap-0.5 pb-0.5 text-xs text-muted-foreground">
                          <Minus className="w-3 h-3" /> same
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {momentum.scoreDelta != null
                    ? momentum.scoreDelta > 0
                      ? "Up vs. last week 🎯"
                      : momentum.scoreDelta < 0
                      ? "Down vs. last week"
                      : "Same as last week"
                    : momentum.lastWeekAvgScore == null
                    ? "No data from last week yet"
                    : "vs. last week"
                  }
                </p>
              </div>

              {/* Set win rate */}
              <div className="bg-background/60 rounded-lg p-3.5 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Set Performance
                </p>
                {(momentum.safeWins + momentum.expWins) > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <Shield className="w-3 h-3" />
                        {momentum.safeWins}
                      </div>
                      <span className="text-muted-foreground text-xs">vs</span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-orange-400">
                        <FlaskConical className="w-3 h-3" />
                        {momentum.expWins}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {momentum.safeWins > momentum.expWins
                        ? "Safe sets used more often"
                        : momentum.expWins > momentum.safeWins
                        ? "Experimental sets winning"
                        : "Tied between sets"}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground leading-none">—</span>
                    <p className="text-[11px] text-muted-foreground">Log a post to track</p>
                  </>
                )}
              </div>

            </div>

            {/* Best win highlight */}
            {momentum.bestWin && (
              <div className="bg-background/60 rounded-lg px-4 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {momentum.bestWin.multiplier
                      ? <>Your best post hit <span className="text-amber-400">{momentum.bestWin.metric.toLocaleString()} views</span> — {momentum.bestWin.multiplier}× your average.</>
                      : <>Your best post hit <span className="text-amber-400">{momentum.bestWin.metric.toLocaleString()} views</span> using the {momentum.bestWin.setChosen === "safe" ? "Safe" : "Experimental"} set.</>
                    }
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    "{momentum.bestWin.caption}"
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 flex items-center gap-1 mt-0.5",
                  momentum.bestWin.setChosen === "safe"
                    ? "bg-primary/10 text-primary"
                    : "bg-orange-500/10 text-orange-400"
                )}>
                  {momentum.bestWin.setChosen === "safe"
                    ? <><Shield className="w-2.5 h-2.5" /> Safe</>
                    : <><FlaskConical className="w-2.5 h-2.5" /> Exp.</>
                  }
                </span>
              </div>
            )}

            {/* Zero-this-week nudge */}
            {momentum.thisWeekCount === 0 && (
              <div className="flex items-center justify-between gap-3 bg-background/40 rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  No posts optimised yet this week — run an analysis to keep your momentum going.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/hashtag-analysis")}
                  className="gap-1.5 flex-shrink-0 text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Zap className="w-3 h-3" />
                  Analyse Now
                </Button>
              </div>
            )}

          </div>
        )}

        {/* ── 3. Top Action Spotlight + Activity Feed ───────────────────── */}
        <div className="grid lg:grid-cols-5 gap-4">

          {/* Top Action Today */}
          <div className="lg:col-span-2">
            {loading
              ? <Skeleton className="h-52" />
              : topAction && (
                <div className="h-full rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                      <topAction.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                      Your Top Action Today
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-base font-bold text-foreground leading-snug">
                      {topAction.headline}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {topAction.detail}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => navigate(topAction.path)}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {topAction.cta}
                  </Button>
                </div>
              )
            }
          </div>

          {/* Live Activity Feed — news ticker */}
          <div className="lg:col-span-3">
            <Card className="border-border h-full">
              <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                <Activity className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Live Activity Feed</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {loading
                  ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10" />)}</div>
                  : data?.recentScans.length === 0
                    ? <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
                    : (
                      <div className="divide-y divide-border">
                        {data?.recentScans.map((scan) => {
                          const done = scan.status?.toLowerCase() === "completed";
                          const failed = scan.status?.toLowerCase() === "failed";
                          const recent = isRecent(scan.startedAt);
                          return (
                            <div
                              key={scan.snapshotId}
                              className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/20 rounded-lg px-2 -mx-2 transition-colors group"
                              onClick={() => navigate(`/seo/results?snapshot=${scan.snapshotId}`)}
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0 mt-0.5",
                                done ? "bg-emerald-500" : failed ? "bg-red-500" : "bg-amber-400 animate-pulse"
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-foreground truncate">
                                    {scan.siteUrl.replace(/^https?:\/\//, "")}
                                  </span>
                                  {recent && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold shrink-0 uppercase tracking-wide">
                                      New
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  Intelligence scan {done ? "completed" : failed ? "failed" : "running"}
                                </span>
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                {timeAgo(scan.startedAt)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-transparent group-hover:text-muted-foreground/50 transition-all shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )
                }
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── 4. Brand Intelligence Table ───────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Brand Intelligence</CardTitle>
            <Link to="/seo" className="text-xs text-primary hover:underline flex items-center gap-1">
              All sites <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : data?.sitePerf.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No completed scans yet.</p>
                <Link to="/seo" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Run your first scan →
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 pb-2 mb-1 text-xs font-medium text-muted-foreground border-b border-border">
                  <span>Site</span>
                  <span className="w-32 text-center">Opportunity</span>
                  <span className="w-24 text-center">Structural</span>
                </div>
                {data?.sitePerf.map((site) => (
                  <div
                    key={site.siteId}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20 rounded-lg px-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/seo/results?snapshot=${site.snapshotId}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {site.siteUrl.replace(/^https?:\/\//, "")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {site.pagesCrawled} pages · {timeAgo(site.finishedAt)}
                      </p>
                    </div>
                    <div className="w-32"><ScoreBar value={site.opportunity} /></div>
                    <div className="w-24"><ScoreBar value={site.structural} /></div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Scans running warning ─────────────────────────────────────── */}
        {!loading && data && data.sitesCount > 0 && data.sitePerf.length === 0 && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Scans in progress</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Intelligence scans are running. Results will appear here once complete.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/seo")}>View Scans</Button>
            </CardContent>
          </Card>
        )}

        {/* ── 5. Marketing Toolkit ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Marketing Toolkit</h2>
            <p className="text-xs text-muted-foreground">Jump into any tool</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {toolkit.map((tool) => (
              <Link key={tool.label} to={tool.path}>
                <Card className="border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                      <tool.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {tool.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{tool.description}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
