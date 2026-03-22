import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, ArrowLeft, AlertTriangle, CheckCircle2, Info, Loader2, ExternalLink, History, Link2, RefreshCw, Unlink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { startQueuedSeoScan } from "@/lib/sccFakeProcessor";
import SiteSummarySection from "@/components/seo/SiteSummarySection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface SnapshotRow {
  id: string;
  site_id: string;
  status: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  progress_step?: string | null;
  error_message?: string | null;
  notes?: string | null;
}

interface SiteRow {
  id: string;
  site_url?: string | null;
  url?: string | null;
  domain?: string | null;
}

interface PageMetric {
  id: string;
  page_id: string;
  structural_score?: number | null;
  visibility_score?: number | null;
  revenue_score?: number | null;
  paid_risk_score?: number | null;
  page_opportunity_score?: number | null;
  priority_bucket?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  avg_position?: number | null;
  ctr?: number | null;
  performance_score_mobile?: number | null;
  performance_score_desktop?: number | null;
  lcp_ms?: number | null;
  cls_score?: number | null;
  inp_ms?: number | null;
  crux_lcp_ms?: number | null;
  crux_cls_score?: number | null;
  crux_inp_ms?: number | null;
  crux_lcp_rating?: string | null;
  crux_cls_rating?: string | null;
  crux_inp_rating?: string | null;
  page?: { url?: string | null; page_type?: string | null } | null;
}

interface ActionRow {
  id: string;
  title?: string | null;
  why_it_matters?: string | null;
  technical_reason?: string | null;
  expected_impact_range?: string | null;
  steps?: string[] | null;
  severity?: string | null;
  page_id?: string | null;
  page?: { url?: string | null } | null;
}

interface QueryMetricRow {
  id: string;
  query_id: string;
  impressions?: number | null;
  clicks?: number | null;
  avg_position?: number | null;
  ctr?: number | null;
  visibility_score?: number | null;
  query_opportunity_score?: number | null;
  priority_bucket?: string | null;
  query?: {
    query_text?: string | null;
    query_category?: string | null;
    intent_type?: string | null;
  } | null;
}

const severityColor: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
const POLL_MS = 2500;

function safeDateText(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function safeNum(value?: number | null, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isMeaningfulTrafficValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatTrafficNumber(value?: number | null) {
  return isMeaningfulTrafficValue(value) ? safeNum(value).toLocaleString() : "N/A";
}

function formatTrafficPercent(value?: number | null) {
  // CTR is stored as a percentage already (e.g. 13.87 means 13.87%)
  return isMeaningfulTrafficValue(value) ? `${safeNum(value).toFixed(1)}%` : "N/A";
}

function formatTrafficPosition(value?: number | null) {
  return isMeaningfulTrafficValue(value) ? `${safeNum(value)}` : "N/A";
}

function siteDisplayUrl(site: SiteRow | null) {
  if (!site) return "";
  return site.site_url || site.url || site.domain || "";
}

function cwvColor(value: number, greenMax: number, amberMax: number, invert = false): string {
  if (invert) {
    // Higher is better (e.g. performance score)
    if (value >= greenMax) return "text-emerald-400";
    if (value >= amberMax) return "text-amber-400";
    return "text-destructive";
  }
  // Lower is better (e.g. LCP, CLS, INP)
  if (value < greenMax) return "text-emerald-400";
  if (value < amberMax) return "text-amber-400";
  return "text-destructive";
}

function cruxRatingColor(rating?: string | null): string {
  const r = (rating || "").toUpperCase();
  if (r === "FAST") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (r === "AVERAGE") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (r === "SLOW") return "bg-destructive/15 text-destructive border-destructive/30";
  return "";
}

function hasValue(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function ActionCard({ action }: { action: ActionRow }) {
  const steps: string[] = Array.isArray(action.steps) ? action.steps : [];
  const severity = (action.severity || "low").toLowerCase();
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`${severityColor[severity] || ""} text-xs capitalize gap-1`}>
                {severity === "high" ? <AlertTriangle className="w-3 h-3" /> : severity === "medium" ? <Info className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {severity}
              </Badge>
              {action.page?.url && (
                <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                  {action.page.url}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-foreground text-sm">{action.title || "Untitled action"}</h3>
            {action.why_it_matters && (
              <p className="text-sm text-muted-foreground">{action.why_it_matters}</p>
            )}
            {action.technical_reason && (
              <p className="text-xs text-muted-foreground/70 font-mono">{action.technical_reason}</p>
            )}
          </div>
          {action.expected_impact_range && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
              {action.expected_impact_range}
            </Badge>
          )}
        </div>
        {steps.length > 0 && (
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground pl-1">
            {steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ActionSection({
  title,
  actions,
  emptyText,
  showPageUrl,
}: {
  title: string;
  actions: ActionRow[];
  emptyText: string;
  showPageUrl: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {actions.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-6 text-sm text-muted-foreground">{emptyText}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => <ActionCard key={action.id} action={action} />)}
        </div>
      )}
    </section>
  );
}

const SEOResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const snapshotId = searchParams.get("snapshot");

  const [rescanning, setRescanning] = useState(false);
  const [maxPages, setMaxPages] = useState<8 | 25 | 50>(8);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gscConnection, setGscConnection] = useState<{ id: string; gsc_property: string } | null>(null);
  const [syncingGsc, setSyncingGsc] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotRow | null>(null);
  const [site, setSite] = useState<SiteRow | null>(null);
  const [metrics, setMetrics] = useState<PageMetric[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [pastSnapshots, setPastSnapshots] = useState<
    { id: string; started_at?: string | null; status?: string | null }[]
  >([]);
  const [queryMetrics, setQueryMetrics] = useState<QueryMetricRow[]>([]);
  const [viewTab, setViewTab] = useState<"pages" | "queries">("pages");

  const isProcessing = useMemo(() => {
    const status = (snapshot?.status || "").toLowerCase();
    return status === "queued" || status === "running" || status === "processing";
  }, [snapshot?.status]);

  useEffect(() => {
    if (!snapshotId) {
      setError("No snapshot ID provided.");
      setLoading(false);
      return;
    }

    void fetchResults(snapshotId, true);

    return () => {};
  }, [snapshotId]);

  useEffect(() => {
    if (!snapshotId || !isProcessing) return;

    const interval = window.setInterval(() => {
      void fetchResults(snapshotId, false, true);
    }, POLL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [snapshotId, isProcessing]);

  async function fetchResults(snapId: string, showInitialLoader = false, backgroundRefresh = false) {
    if (showInitialLoader) setLoading(true);
    if (backgroundRefresh) setRefreshing(true);
    setError(null);

    try {
      const { data: snap, error: snapErr } = await (supabase as any)
        .from("scc_snapshots")
        .select("*")
        .eq("id", snapId)
        .single();

      if (snapErr) throw new Error(snapErr.message);
      setSnapshot(snap as SnapshotRow);

      const { data: siteData, error: siteErr } = await (supabase as any)
        .from("scc_sites")
        .select("*")
        .eq("id", snap.site_id)
        .single();

      if (siteErr) throw new Error(siteErr.message);
      setSite(siteData as SiteRow);

      // Load GSC connection for this site
      const { data: gscData } = await (supabase as any)
        .from("scc_gsc_connections")
        .select("id, gsc_property")
        .eq("site_id", snap.site_id)
        .maybeSingle();
      setGscConnection(gscData || null);

      const { data: snapshotsData, error: snapshotsErr } = await (supabase as any)
        .from("scc_snapshots")
        .select("id, started_at, status")
        .eq("site_id", snap.site_id)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(10);

      if (snapshotsErr) throw new Error(snapshotsErr.message);
      setPastSnapshots(snapshotsData || []);

      const { data: metricsData, error: metricsErr } = await (supabase as any)
        .from("scc_page_snapshot_metrics")
        .select("*, page:scc_pages(url, page_type)")
        .eq("snapshot_id", snapId)
        .order("page_opportunity_score", { ascending: false, nullsFirst: false });

      if (metricsErr) throw new Error(metricsErr.message);
      setMetrics(Array.isArray(metricsData) ? metricsData : []);

      const { data: actionsData, error: actionsErr } = await (supabase as any)
        .from("scc_actions")
        .select("*, page:scc_pages(url)")
        .eq("snapshot_id", snapId);

      if (actionsErr) throw new Error(actionsErr.message);

      const sortedActions = (Array.isArray(actionsData) ? actionsData : []).sort(
        (a: ActionRow, b: ActionRow) =>
          (severityOrder[(a.severity || "").toLowerCase()] ?? 3) -
          (severityOrder[(b.severity || "").toLowerCase()] ?? 3),
      );
      setActions(sortedActions);

      const { data: qmData, error: qmErr } = await (supabase as any)
        .from("scc_query_snapshot_metrics")
        .select("*, query:scc_queries(query_text, query_category, intent_type)")
        .eq("snapshot_id", snapId)
        .order("query_opportunity_score", { ascending: false, nullsFirst: false });

      if (qmErr) throw new Error(qmErr.message);
      setQueryMetrics(Array.isArray(qmData) ? qmData : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load SEO results");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSyncGsc() {
    if (!site || !snapshotId || syncingGsc) return;
    setSyncingGsc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://njnnpdrevbkhbhzwccuz.supabase.co/functions/v1/gsc-fetch-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({ site_id: site.id, snapshot_id: snapshotId }),
        }
      );
      const result = await res.json();
      if (result.ok) {
        toast({ title: "GSC data synced!", description: `Updated ${result.updated} of ${result.pages} pages.` });
        void fetchResults(snapshotId, false, true);
      } else {
        toast({ title: "GSC sync skipped", description: result.reason || "No data available.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "GSC sync failed", description: err?.message, variant: "destructive" });
    } finally {
      setSyncingGsc(false);
    }
  }

  async function handleDisconnectGsc() {
    if (!gscConnection) return;
    await (supabase as any).from("scc_gsc_connections").delete().eq("id", gscConnection.id);
    setGscConnection(null);
    toast({ title: "Search Console disconnected" });
  }

  async function handleNewScan() {
    if (!site || rescanning) return;

    const currentSiteUrl = siteDisplayUrl(site);
    if (!currentSiteUrl) {
      toast({
        title: "Missing site URL",
        description: "Could not determine the website URL for this scan.",
        variant: "destructive",
      });
      return;
    }

    setRescanning(true);
    setError(null);

    try {
      const { snapshotId: newSnapshotId } = await startQueuedSeoScan({
        siteId: site.id,
        seedUrl: currentSiteUrl,
        mode: "seo_intelligence",
        maxPages,
        maxDepth: 1,
      });

      setSearchParams({ snapshot: newSnapshotId });
      await fetchResults(newSnapshotId, true);

      toast({
        title: "Scan started",
        description: "Your new SEO scan has been queued successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to start scan",
        variant: "destructive",
      });
      setError(err?.message || "Failed to start scan");
    } finally {
      setRescanning(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/30">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Error Loading Results</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" onClick={() => navigate("/seo")}>
              Back to SEO
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Snapshot not found</h2>
            <p className="text-muted-foreground text-sm">We could not find results for this scan.</p>
            <Button variant="outline" onClick={() => navigate("/seo")}>
              Back to SEO
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/seo")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SEO
          </button>

          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            Scan Results
          </h1>

          {site && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{siteDisplayUrl(site)}</span>
              <span>·</span>
              <span>Status: {snapshot.status || "unknown"}</span>
              <span>·</span>
              <span>{snapshot.finished_at ? `Finished: ${safeDateText(snapshot.finished_at)}` : `Started: ${safeDateText(snapshot.started_at)}`}</span>
              {refreshing && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Refreshing
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pastSnapshots.length > 1 && (
            <Select
              value={snapshotId || ""}
              onValueChange={(val) => {
                setSearchParams({ snapshot: val });
              }}
            >
              <SelectTrigger className="w-[220px] h-9 text-xs">
                <History className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Previous scans" />
              </SelectTrigger>
              <SelectContent>
                {pastSnapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {safeDateText(s.started_at)} {s.id === snapshotId ? "(current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
            {([8, 25, 50] as const).map((n) => (
              <button
                key={n}
                onClick={() => setMaxPages(n)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  maxPages === n
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n}p
              </button>
            ))}
          </div>

          <Button onClick={handleNewScan} variant="outline" size="sm" disabled={rescanning}>
            {rescanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                Scanning…
              </>
            ) : (
              "Run New Scan"
            )}
          </Button>
        </div>
      </div>

      {/* GSC connection strip */}
      {gscConnection ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm flex-wrap">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 font-medium">Search Console</span>
          <Select value={gscConnection.gsc_property} onValueChange={() => {}}>
            <SelectTrigger className="h-6 w-auto text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-300 gap-1 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={gscConnection.gsc_property} className="text-xs">
                {gscConnection.gsc_property}
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-emerald-500/70 text-xs">· Last 90 days</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300" onClick={handleSyncGsc} disabled={syncingGsc}>
              {syncingGsc ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sync
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive" onClick={handleDisconnectGsc}>
              <Unlink className="w-3 h-3" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
          <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground text-xs">Connect Google Search Console to see real impressions, clicks and position data.</span>
        </div>
      )}

      {isProcessing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Scan in progress</p>
              <p className="text-muted-foreground">Current step: {snapshot.progress_step || "processing"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewTab("pages")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewTab === "pages"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pages
        </button>
        <button
          onClick={() => setViewTab("queries")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewTab === "queries"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Queries
        </button>
      </div>

      <SiteSummarySection notes={snapshot?.notes} />

      {viewTab === "pages" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Top Opportunities</h2>

          {metrics.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No page metrics available for this snapshot yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {metrics.map((m) => {
                const bucketRaw = (m.priority_bucket || "").toLowerCase();
                const priorityColor =
                  bucketRaw === "tier 1"
                    ? "bg-destructive/15 text-destructive border-destructive/30"
                    : bucketRaw === "tier 2"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-primary/15 text-primary border-primary/30";

                return (
                  <Card key={m.id} className="border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {m.page?.page_type || "page"}
                        </Badge>
                        <Badge
                          className={priorityColor}
                          variant="outline"
                        >
                          {m.priority_bucket || "—"} priority
                        </Badge>
                      </div>

                      <CardTitle className="text-sm font-medium mt-2 truncate">
                        {m.page?.url || "Unknown page"}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Opportunity</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(m.page_opportunity_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Visibility</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(m.visibility_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Structural</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(m.structural_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Revenue</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(m.revenue_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Paid Risk</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(m.paid_risk_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Avg Position</span>
                          <p className="font-medium text-foreground">{formatTrafficPosition(m.avg_position)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Impressions</span>
                          <p className="font-medium text-foreground">{formatTrafficNumber(m.impressions)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Clicks</span>
                          <p className="font-medium text-foreground">{formatTrafficNumber(m.clicks)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">CTR</span>
                          <p className="font-medium text-foreground">{formatTrafficPercent(m.ctr)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {viewTab === "queries" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Query Opportunities</h2>

          {queryMetrics.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No query data for this snapshot yet. The crawler is working, but keyword/query metrics are not being
                generated yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {queryMetrics.map((qm) => {
                const priority = (qm.priority_bucket || "low").toLowerCase();

                return (
                  <Card key={qm.id} className="border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs capitalize">
                          {qm.query?.intent_type || "unknown"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            priority === "high"
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : priority === "medium"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-muted text-muted-foreground border-border"
                          }
                        >
                          {priority} priority
                        </Badge>
                      </div>

                      <CardTitle className="text-sm font-medium mt-2">
                        “{qm.query?.query_text || "Unknown query"}”
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Opportunity</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(qm.query_opportunity_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Visibility</span>
                          <p className="text-lg font-bold text-foreground">{safeNum(qm.visibility_score)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Impressions</span>
                          <p className="font-medium text-foreground">{formatTrafficNumber(qm.impressions)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Clicks</span>
                          <p className="font-medium text-foreground">{formatTrafficNumber(qm.clicks)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">CTR</span>
                          <p className="font-medium text-foreground">{formatTrafficPercent(qm.ctr)}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Avg Position</span>
                          <p className="font-medium text-foreground">{formatTrafficPosition(qm.avg_position)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      <ActionSection
        title="Site-Wide Recommendations"
        actions={actions.filter((a) => !a.page_id)}
        emptyText="No site-wide recommendations for this snapshot."
        showPageUrl={false}
      />

      <ActionSection
        title="Page-Level Actions"
        actions={actions.filter((a) => !!a.page_id)}
        emptyText="No page-level actions were generated for this snapshot yet."
        showPageUrl={true}
      />
    </div>
  );
};

export default SEOResults;
