import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, TrendingUp, FileText, Zap, Globe, ArrowRight,
  Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  Megaphone, Users, BarChart3, Brain,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

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
  // Rotate daily — same greeting all day for the whole team, new one each morning
  const today = new Date().toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  return GREETINGS[Math.abs(hash) % GREETINGS.length](brand);
}

function getDateLine(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function ScoreBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-6 text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return (
    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
      <CheckCircle2 className="w-2.5 h-2.5" /> Done
    </Badge>
  );
  if (s === "failed") return (
    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-destructive/10 text-destructive border-destructive/20 gap-1">
      <XCircle className="w-2.5 h-2.5" /> Failed
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running
    </Badge>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const brandName = profile?.brand_name || profile?.full_name || "Your Brand";
  const greeting = getDailyGreeting(brandName);

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: sites } = await (supabase as any)
      .from("scc_sites")
      .select("id, site_url")
      .eq("user_id", user.id);

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
      .from("scc_crawl_jobs")
      .select("pages_done")
      .in("site_id", siteIds)
      .eq("status", "completed");

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
        .from("scc_actions")
        .select("id", { count: "exact", head: true })
        .in("snapshot_id", latestSnapIds);
      actionsCount = count || 0;
    }

    const sitePerf: SitePerf[] = Object.values(latestPerSite).map(snap => {
      const { opportunity, structural, pagesCrawled: pc } = parseNotes(snap.notes);
      return {
        siteId: snap.site_id,
        siteUrl: siteMap[snap.site_id] || snap.site_id,
        snapshotId: snap.id,
        opportunity,
        structural,
        pagesCrawled: pc,
        finishedAt: snap.finished_at,
      };
    }).sort((a, b) => b.opportunity - a.opportunity);

    const recentScans: RecentScan[] = snaps.slice(0, 8).map(snap => ({
      snapshotId: snap.id,
      siteUrl: siteMap[snap.site_id] || snap.site_id,
      status: snap.status,
      startedAt: snap.started_at,
    }));

    setData({ sitesCount: sites.length, scansCount: snaps.length, pagesCrawled, actionsCount, sitePerf, recentScans });
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!loading && data?.sitesCount === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-5 max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {greeting}
            </h1>
            <p className="text-sm text-muted-foreground">
              Run your first brand intelligence scan to unlock your full dashboard.
            </p>
          </div>
          <Button onClick={() => navigate("/seo")} className="gap-2">
            <Search className="w-4 h-4" /> Run Your First Scan
          </Button>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Domains Tracked", value: data?.sitesCount ?? "—", icon: Globe, sub: "active sites" },
    { label: "Intelligence Scans", value: data?.scansCount ?? "—", icon: Search, sub: "all time" },
    { label: "Pages Analysed", value: data?.pagesCrawled ?? "—", icon: FileText, sub: "across all scans" },
    { label: "Open Actions", value: data?.actionsCount ?? "—", icon: Zap, sub: "recommendations" },
  ];

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
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Briefing Header ─────────────────────────────────────────────── */}
        <div className="briefing-card p-6 space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
            {getDateLine()} · Brand Intelligence Briefing
          </p>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-3/4 bg-secondary animate-pulse rounded-lg" />
              <div className="h-4 w-1/2 bg-secondary animate-pulse rounded-lg" />
            </div>
          ) : (
            <h1 className="text-2xl lg:text-3xl font-bold leading-snug text-foreground max-w-3xl">
              {greeting}
            </h1>
          )}
          <p className="text-sm text-muted-foreground">
            Here's your marketing intelligence overview for today.
          </p>
        </div>

        {/* ── Intelligence Snapshot ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <kpi.icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
                {loading ? (
                  <div className="h-7 w-14 bg-secondary animate-pulse rounded mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground tabular-nums">{kpi.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Main Grid ────────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Brand Intelligence — Site Performance */}
          <Card className="lg:col-span-2 border-border">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-foreground">Brand Intelligence</CardTitle>
              <Link to="/seo" className="text-xs text-primary hover:underline flex items-center gap-1">
                All sites <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-secondary animate-pulse rounded-lg" />)}
                </div>
              ) : data?.sitePerf.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No completed scans yet.</p>
                  <Link to="/seo" className="text-xs text-primary hover:underline mt-1 inline-block">
                    Run your first scan →
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 pb-2 mb-1 text-xs text-muted-foreground border-b border-border">
                    <span>Site</span>
                    <span className="w-28 text-center">Opportunity</span>
                    <span className="w-20 text-center">Structural</span>
                  </div>
                  {data?.sitePerf.map((site) => (
                    <div
                      key={site.siteId}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20 rounded-lg px-2 -mx-2 transition-colors"
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
                      <div className="w-28"><ScoreBar value={site.opportunity} /></div>
                      <div className="w-20"><ScoreBar value={site.structural} /></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="border-border">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-9 bg-secondary animate-pulse rounded-lg" />)}
                </div>
              ) : data?.recentScans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No recent activity.</p>
              ) : (
                <div>
                  {data?.recentScans.map((scan) => (
                    <div
                      key={scan.snapshotId}
                      className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20 rounded-lg px-2 -mx-2 transition-colors"
                      onClick={() => navigate(`/seo/results?snapshot=${scan.snapshotId}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {scan.siteUrl.replace(/^https?:\/\//, "")}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> {timeAgo(scan.startedAt)}
                        </p>
                      </div>
                      <StatusBadge status={scan.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Scans in progress warning ───────────────────────────────────── */}
        {!loading && data && data.sitesCount > 0 && data.sitePerf.length === 0 && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Scans in progress</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your intelligence scans are running. Results will appear here once complete.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/seo")}>
                View Scans
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Marketing Toolkit ───────────────────────────────────────────── */}
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
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {tool.description}
                      </p>
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
