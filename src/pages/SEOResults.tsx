import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, ArrowLeft, AlertTriangle, CheckCircle2, Info, Loader2, ExternalLink, History, Link2, RefreshCw, Unlink, Users, Globe, MapPin, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { startQueuedSeoScan } from "@/lib/sccFakeProcessor";
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
  executive_summary?: string | null;
  total_monthly_loss_min?: number | null;
  total_monthly_loss_max?: number | null;
  currency_symbol?: string | null;
  market?: string | null;
  industry?: string | null;
  value_per_visitor?: number | null;
  estimated_monthly_traffic?: number | null;
  confidence_score?: number | null;
  safe_browsing_threat?: boolean | null;
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
  money_loss_min?: number | null;
  money_loss_max?: number | null;
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
  return isMeaningfulTrafficValue(value) ? `${safeNum(value).toFixed(1)}%` : "N/A";
}

function formatTrafficPosition(value?: number | null) {
  return isMeaningfulTrafficValue(value) ? `${safeNum(value)}` : "N/A";
}

function siteDisplayUrl(site: SiteRow | null) {
  if (!site) return "";
  return site.site_url || site.url || site.domain || "";
}

function formatMoneyRange(min?: number | string | null, max?: number | string | null, currency = "$") {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n));
  const minN = Number(min); const maxN = Number(max);
  if (minN > 0 && maxN > minN) return `${currency}${fmt(minN)} – ${currency}${fmt(maxN)}`;
  if (minN > 0) return `${currency}${fmt(minN)}`;
  return null;
}

function marketFlag(market?: string | null): string {
  if (!market) return "🌍";
  const m = market.toUpperCase();
  if (m === "UK" || m === "GB") return "🇬🇧";
  if (m === "US") return "🇺🇸";
  if (m === "CA") return "🇨🇦";
  if (m === "AU") return "🇦🇺";
  if (m === "DE") return "🇩🇪";
  if (m === "FR") return "🇫🇷";
  return "🌍";
}

interface MoneyData {
  total_monthly_loss_min?: number;
  total_monthly_loss_max?: number;
  currency_symbol?: string;
  market?: string;
  industry?: string;
  confidence_score?: number;
  estimated_monthly_traffic?: number;
  value_per_visitor?: number;
  executive_summary?: string;
  safe_browsing_threat?: boolean;
}

function extractMoney(snapshot: SnapshotRow): MoneyData {
  const notesObj = (() => { try { return JSON.parse(snapshot.notes || "{}"); } catch { return {}; } })();
  const m = notesObj.money || {};
  return {
    total_monthly_loss_min: Number(m.total_monthly_loss_min ?? snapshot.total_monthly_loss_min ?? 0),
    total_monthly_loss_max: Number(m.total_monthly_loss_max ?? snapshot.total_monthly_loss_max ?? 0),
    currency_symbol: m.currency_symbol || snapshot.currency_symbol || "$",
    market: m.market || snapshot.market,
    industry: m.industry || snapshot.industry,
    confidence_score: m.confidence_score ?? snapshot.confidence_score,
    estimated_monthly_traffic: Number(m.estimated_monthly_traffic ?? snapshot.estimated_monthly_traffic ?? 0),
    value_per_visitor: Number(m.value_per_visitor ?? snapshot.value_per_visitor ?? 0),
    executive_summary: m.executive_summary || snapshot.executive_summary,
    safe_browsing_threat: m.safe_browsing_threat ?? snapshot.safe_browsing_threat,
  };
}

function HeroMoneyBanner({ snapshot }: { snapshot: SnapshotRow }) {
  const money = extractMoney(snapshot);
  const lossMin = money.total_monthly_loss_min || 0;
  if (lossMin <= 0) return null;

  const currency = money.currency_symbol || "$";
  const lossText = formatMoneyRange(lossMin, money.total_monthly_loss_max, currency);

  return (
    <div className="space-y-0">
      {money.safe_browsing_threat && (
        <div className="rounded-t-xl bg-destructive/20 border border-destructive/40 px-5 py-3 text-sm font-medium text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          ⚠️ Google has flagged this site as unsafe — all traffic is being blocked
        </div>
      )}
      <Card className={`border-border bg-card ${money.safe_browsing_threat ? "rounded-t-none" : ""}`}>
        <CardContent className="p-6 md:p-8 space-y-4">
          <p className="text-sm text-muted-foreground font-medium">Your website is losing an estimated</p>
          <p className="text-4xl md:text-5xl font-black text-destructive tabular-nums tracking-tight">
            {lossText} <span className="text-lg md:text-xl font-semibold text-muted-foreground">/ month</span>
          </p>
          {money.executive_summary && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{money.executive_summary}</p>
          )}
          {money.confidence_score != null && (
            <span className="text-xs text-muted-foreground/60">Confidence: {money.confidence_score}%</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickStatsRow({ snapshot }: { snapshot: SnapshotRow }) {
  const money = extractMoney(snapshot);
  const hasAny = money.estimated_monthly_traffic || money.industry || money.market;
  if (!hasAny) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Monthly Visitors</p>
            <p className="text-lg font-bold text-foreground">
              ~{money.estimated_monthly_traffic ? money.estimated_monthly_traffic.toLocaleString() : "0"}/mo
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Industry</p>
            <p className="text-lg font-bold text-foreground capitalize">{money.industry || "—"}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Market</p>
            <p className="text-lg font-bold text-foreground">{marketFlag(money.market)} {money.market?.toUpperCase() || "—"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SimpleActionCard({ action }: { action: ActionRow }) {
  const steps: string[] = Array.isArray(action.steps) ? action.steps : [];
  const severity = (action.severity || "low").toLowerCase();
  const moneyText = formatMoneyRange(action.money_loss_min, action.money_loss_max);

  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`${severityColor[severity] || ""} text-xs capitalize gap-1`}>
                {severity === "high" ? <AlertTriangle className="w-3 h-3" /> : severity === "medium" ? <Info className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {severity}
              </Badge>
              {moneyText && (
                <span className="text-xs font-medium text-amber-400">~{moneyText}/mo lost</span>
              )}
            </div>
            <h3 className="font-semibold text-foreground text-sm">{action.title || "Untitled action"}</h3>
            {action.why_it_matters && (
              <p className="text-sm text-muted-foreground leading-relaxed">{action.why_it_matters}</p>
            )}
            {action.page?.url && (
              <p className="text-xs text-muted-foreground/70 font-mono truncate">📄 {action.page.url}</p>
            )}
          </div>
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

function SimpleActionSection({
  title,
  actions,
  emptyText,
}: {
  title: string;
  actions: ActionRow[];
  emptyText: string;
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
          {actions.map((action) => <SimpleActionCard key={action.id} action={action} />)}
        </div>
      )}
    </section>
  );
}

function GscSuggestBanner({ metrics }: { metrics: PageMetric[] }) {
  // Check if any metric has real GSC data
  const hasGscData = metrics.some(m =>
    isMeaningfulTrafficValue(m.impressions) || isMeaningfulTrafficValue(m.clicks)
  );
  if (hasGscData) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
      <Search className="w-4 h-4 text-accent shrink-0" />
      <div>
        <span className="text-accent font-medium">Get better insights</span>
        <span className="text-muted-foreground ml-1">— Connect Google Search Console to see real search impressions, clicks and position data for your pages.</span>
      </div>
    </div>
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
    return () => { window.clearInterval(interval); };
  }, [snapshotId, isProcessing]);

  async function fetchResults(snapId: string, showInitialLoader = false, backgroundRefresh = false) {
    if (showInitialLoader) setLoading(true);
    if (backgroundRefresh) setRefreshing(true);
    setError(null);

    try {
      const { data: snap, error: snapErr } = await (supabase as any)
        .from("scc_snapshots")
        .select("id,site_id,status,started_at,finished_at,progress_step,error_message,notes,market,currency,currency_symbol,industry,business_name,value_per_visitor,estimated_monthly_traffic,total_monthly_loss_min,total_monthly_loss_max,safe_browsing_threat,indexed_page_count,executive_summary,confidence_score")
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
      toast({ title: "Missing site URL", description: "Could not determine the website URL for this scan.", variant: "destructive" });
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
      toast({ title: "Scan started", description: "Your new SEO scan has been queued successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to start scan", variant: "destructive" });
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
            <Button variant="outline" onClick={() => navigate("/seo")}>Back to SEO</Button>
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
            <Button variant="outline" onClick={() => navigate("/seo")}>Back to SEO</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Scan Header — unchanged */}
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
            <Select value={snapshotId || ""} onValueChange={(val) => setSearchParams({ snapshot: val })}>
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
              <><Loader2 className="w-4 h-4 animate-spin mr-1" />Scanning…</>
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
      ) : null}

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

      {/* Hero money banner */}
      <HeroMoneyBanner snapshot={snapshot} />

      {/* Quick stats row */}
      <QuickStatsRow snapshot={snapshot} />

      {/* GSC suggest banner (soft blue, only if no GSC data) */}
      {!gscConnection && <GscSuggestBanner metrics={metrics} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewTab("pages")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewTab === "pages"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pages Scanned
        </button>
        <button
          onClick={() => setViewTab("queries")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewTab === "queries"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Search Queries
        </button>
      </div>

      {viewTab === "pages" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Pages Scanned</h2>

          {metrics.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No page data available for this snapshot yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {metrics.map((m) => (
                <Card key={m.id} className="border-border">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{m.page?.url || "Unknown page"}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] capitalize">{m.page?.page_type || "page"}</Badge>
                        {isMeaningfulTrafficValue(m.impressions) && <span>{safeNum(m.impressions).toLocaleString()} impressions</span>}
                        {isMeaningfulTrafficValue(m.clicks) && <span>{safeNum(m.clicks).toLocaleString()} clicks</span>}
                        {isMeaningfulTrafficValue(m.avg_position) && <span>Position: {safeNum(m.avg_position)}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {viewTab === "queries" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Search Queries</h2>

          {queryMetrics.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No query data for this snapshot yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {queryMetrics.map((qm) => (
                <Card key={qm.id} className="border-border">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">"{qm.query?.query_text || "Unknown query"}"</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] capitalize">{qm.query?.intent_type || "unknown"}</Badge>
                        {isMeaningfulTrafficValue(qm.impressions) && <span>{safeNum(qm.impressions).toLocaleString()} impressions</span>}
                        {isMeaningfulTrafficValue(qm.clicks) && <span>{safeNum(qm.clicks).toLocaleString()} clicks</span>}
                        {isMeaningfulTrafficValue(qm.avg_position) && <span>Position: {safeNum(qm.avg_position)}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* What to Fix First (site-wide) */}
      <SimpleActionSection
        title="What to Fix First"
        actions={actions.filter((a) => !a.page_id)}
        emptyText="No site-wide recommendations for this snapshot."
      />

      {/* Page-by-Page Actions */}
      <SimpleActionSection
        title="Page-by-Page Actions"
        actions={actions.filter((a) => !!a.page_id)}
        emptyText="No page-level actions were generated for this snapshot yet."
      />
    </div>
  );
};

export default SEOResults;
