import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, TrendingUp, FileText, Zap, Globe, ArrowRight,
  Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground w-6 text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Done</Badge>;
  if (s === "failed") return <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-destructive/10 text-destructive border-destructive/30 gap-0.5"><XCircle className="w-2.5 h-2.5" />Failed</Badge>;
  return <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5"><Loader2 className="w-2.5 h-2.5 animate-spin" />Running</Badge>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setUserName(user.email?.split("@")[0] || "");

    // 1. Sites
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

    // 2. All snapshots for these sites
    const { data: allSnaps } = await (supabase as any)
      .from("scc_snapshots")
      .select("id, site_id, status, started_at, finished_at, notes")
      .in("site_id", siteIds)
      .order("started_at", { ascending: false, nullsFirst: false });

    const snaps: SnapshotRow[] = allSnaps || [];

    // 3. Crawl jobs for pages_done total
    const { data: jobs } = await (supabase as any)
      .from("scc_crawl_jobs")
      .select("pages_done")
      .in("site_id", siteIds)
      .eq("status", "completed");

    const pagesCrawled = (jobs || []).reduce((sum: number, j: { pages_done: number }) => sum + (j.pages_done || 0), 0);

    // 4. Actions count across latest completed snapshots
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

    // Build site performance from latest completed snapshot notes
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

    // Recent scans (last 8, all statuses)
    const recentScans: RecentScan[] = snaps.slice(0, 8).map(snap => ({
      snapshotId: snap.id,
      siteUrl: siteMap[snap.site_id] || snap.site_id,
      status: snap.status,
      startedAt: snap.started_at,
    }));

    setData({
      sitesCount: sites.length,
      scansCount: snaps.length,
      pagesCrawled,
      actionsCount,
      sitePerf,
      recentScans,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!loading && data?.sitesCount === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Marketers Quest</h1>
          <p className="text-muted-foreground text-sm">
            Run your first SEO intelligence scan to start seeing real data on your dashboard.
          </p>
          <Button onClick={() => navigate("/seo")}>
            <Search className="w-4 h-4 mr-2" /> Run Your First SEO Scan
          </Button>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Sites Tracked", value: data?.sitesCount ?? "—", icon: Globe, context: "unique domains" },
    { label: "Total Scans", value: data?.scansCount ?? "—", icon: Search, context: "all time" },
    { label: "Pages Analysed", value: data?.pagesCrawled ?? "—", icon: FileText, context: "across all scans" },
    { label: "Actions Found", value: data?.actionsCount ?? "—", icon: Zap, context: "open recommendations" },
  ];

  return (
    <div className="h-full p-4 lg:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {userName ? `Hey, ${userName} 👋` : "Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your SEO performance at a glance</p>
          </div>
          <Button size="sm" onClick={() => navigate("/seo")}>
            <Search className="w-4 h-4 mr-1.5" /> New Scan
          </Button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    {loading ? (
                      <div className="h-7 w-12 bg-secondary animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">{kpi.context}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <kpi.icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Site Performance */}
          <Card className="lg:col-span-2 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Site Performance</CardTitle>
                <Link to="/seo" className="text-xs text-primary hover:underline flex items-center gap-1">
                  All sites <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-secondary animate-pulse rounded" />)}
                </div>
              ) : data?.sitePerf.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No completed scans yet.{" "}
                  <Link to="/seo" className="text-primary hover:underline">Run a scan</Link>
                </div>
              ) : (
                <>
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 pb-2 text-xs text-muted-foreground border-b border-border">
                    <span>Site</span>
                    <span className="w-28 text-center">Opportunity</span>
                    <span className="w-20 text-center">Structural</span>
                  </div>
                  {data?.sitePerf.map((site) => (
                    <div
                      key={site.siteId}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
                      onClick={() => navigate(`/seo/results?snapshot=${site.snapshotId}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{site.siteUrl.replace(/^https?:\/\//, "")}</p>
                        <p className="text-[10px] text-muted-foreground">{site.pagesCrawled} pages · {timeAgo(site.finishedAt)}</p>
                      </div>
                      <div className="w-28">
                        <ScoreBar value={site.opportunity} />
                      </div>
                      <div className="w-20">
                        <ScoreBar value={site.structural} />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Scans */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Scans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-secondary animate-pulse rounded" />)}
                </div>
              ) : data?.recentScans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No scans yet.</p>
              ) : (
                data?.recentScans.map((scan) => (
                  <div
                    key={scan.snapshotId}
                    className="flex items-center gap-2 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
                    onClick={() => navigate(`/seo/results?snapshot=${scan.snapshotId}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{scan.siteUrl.replace(/^https?:\/\//, "")}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {timeAgo(scan.startedAt)}
                      </p>
                    </div>
                    <StatusBadge status={scan.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "Run SEO Scan", path: "/seo", icon: Search, description: "Analyse a website for SEO opportunities" },
              { label: "Generate Trends", path: "/trend-quest", icon: TrendingUp, description: "Get AI-powered trend recommendations" },
              { label: "Explore Hashtags", path: "/hashtag-analysis", icon: Plus, description: "Analyse trending hashtags for your niche" },
            ].map((action) => (
              <Link key={action.label} to={action.path}>
                <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer group h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                      <action.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* No scan CTA if no completed scans */}
        {!loading && data && data.sitesCount > 0 && data.sitePerf.length === 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Scans in progress</p>
                <p className="text-xs text-muted-foreground">Your scans are running. Performance data will appear here once they complete.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/seo")}>View Scans</Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
