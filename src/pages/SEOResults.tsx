import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, ArrowLeft, AlertTriangle, CheckCircle2, Info, Loader2, ExternalLink, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { runFakeProcessor } from "@/lib/sccFakeProcessor";
import SiteSummarySection from "@/components/seo/SiteSummarySection";
import SiteHealthDashboard from "@/components/seo/SiteHealthDashboard";
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
  return isMeaningfulTrafficValue(value) ? `${(safeNum(value) * 100).toFixed(1)}%` : "N/A";
}

function formatTrafficPosition(value?: number | null) {
  return isMeaningfulTrafficValue(value) ? `${safeNum(value)}` : "N/A";
}

function siteDisplayUrl(site: SiteRow | null) {
  if (!site) return "";
  return site.site_url || site.url || site.domain || "";
}

const SEOResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const snapshotId = searchParams.get("snapshot");

  const [rescanning, setRescanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const pollRef = useRef<number | null>(null);

  const isProcessing = useMemo(() => {
    const status = snapshot?.status || "";
    return status === "queued" || status === "running";
  }, [snapshot?.status]);

  useEffect(() => {
    if (!snapshotId) {
      setError("No snapshot ID provided.");
      setLoading(false);
      return;
    }

    void fetchResults(snapshotId, true);

    return () => {
      if (pollRef.current) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [snapshotId]);

  useEffect(() => {
    if (!snapshotId) return;

    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }

    if (isProcessing) {
      pollRef.current = window.setTimeout(() => {
        void fetchResults(snapshotId, false, true);
      }, POLL_MS);
    }

    return () => {
      if (pollRef.current) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
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
        .select("*")
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
      const { data: snapRow, error: snapErr } = await (supabase as any)
        .from("scc_snapshots")
        .insert({
          site_id: site.id,
          mode: "seo_intelligence",
          status: "queued",
          started_at: new Date().toISOString(),
          progress_step: "queued",
        })
        .select("id")
        .single();

      if (snapErr) throw new Error(snapErr.message);

      const result = await runFakeProcessor(snapRow.id, site.id, currentSiteUrl);

      if (!result.success) {
        toast({
          title: "Scan failed",
          description: result.error || "Scan failed",
          variant: "destructive",
        });
        setError(result.error || "Scan failed");
        return;
      }

      setSearchParams({ snapshot: snapRow.id });
      await fetchResults(snapRow.id, true);
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

  const SeverityIcon = ({ severity }: { severity: string }) => {
    if (severity === "high") return <AlertTriangle className="w-4 h-4" />;
    if (severity === "medium") return <Info className="w-4 h-4" />;
    return <CheckCircle2 className="w-4 h-4" />;
  };

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
              <span>Finished: {safeDateText(snapshot.finished_at || snapshot.started_at)}</span>
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

      {/* Site Health Dashboard — computed from metrics + actions */}
      <SiteHealthDashboard metrics={metrics} actions={actions} />

      {/* Site Summary — rendered from snapshot.notes JSON */}
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
                const priority = (m.priority_bucket || "medium").toLowerCase();

                return (
                  <Card key={m.id} className="border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {m.page?.page_type || "page"}
                        </Badge>
                        <Badge
                          className={
                            priority === "high"
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : priority === "medium"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-primary/15 text-primary border-primary/30"
                          }
                          variant="outline"
                        >
                          {priority} priority
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recommended Actions</h2>

        {actions.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No recommended actions were generated for this snapshot yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => {
              const steps: string[] = Array.isArray(action.steps) ? action.steps : [];
              const severity = (action.severity || "low").toLowerCase();

              return (
                <Card key={action.id} className="border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${severityColor[severity] || ""} text-xs capitalize gap-1`}
                          >
                            <SeverityIcon severity={severity} />
                            {severity}
                          </Badge>
                          <h3 className="font-semibold text-foreground text-sm">{action.title || "Untitled action"}</h3>
                        </div>

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
                        {steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default SEOResults;
