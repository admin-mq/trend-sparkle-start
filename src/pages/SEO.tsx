import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Globe, Loader2, AlertCircle, TrendingUp, TrendingDown,
  Minus, ExternalLink, RefreshCw, Clock, CheckCircle2, XCircle, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { startQueuedSeoScan } from "@/lib/sccFakeProcessor";

// ── Types ────────────────────────────────────────────────────────────────────

interface AvgScores {
  structural?: number;
  visibility?: number;
  opportunity?: number;
  revenue?: number;
  paid_risk?: number;
}

interface SnapshotSummary {
  id: string;
  site_id: string;
  status: string | null;
  progress_step: string | null;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
  _scores?: AvgScores;
  _pagesCrawled?: number;
}

interface SiteRow {
  id: string;
  site_url: string;
  created_at: string | null;
}

interface SiteWithHistory extends SiteRow {
  snapshots: SnapshotSummary[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url.replace(/^http:\/\//i, "https://");
}

function parseNotes(notes: string | null): { scores: AvgScores; pagesCrawled: number } {
  try {
    const obj = JSON.parse(notes || "{}");
    return { scores: obj.avg_scores || {}, pagesCrawled: obj.pages_crawled || 0 };
  } catch {
    return { scores: {}, pagesCrawled: 0 };
  }
}

function safeDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function TrendChip({ label, current, previous }: { label: string; current?: number; previous?: number }) {
  const val = Math.round(current ?? 0);
  const delta = previous != null && current != null ? Math.round(current - previous) : null;

  let icon = <Minus className="w-3 h-3" />;
  let colorClass = "text-muted-foreground";

  if (delta != null) {
    if (delta > 3) { icon = <TrendingUp className="w-3 h-3" />; colorClass = "text-emerald-400"; }
    else if (delta < -3) { icon = <TrendingDown className="w-3 h-3" />; colorClass = "text-destructive"; }
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-bold text-foreground">{val}</span>
      <span className={`flex items-center gap-0.5 text-xs ${colorClass}`}>
        {icon}
        {delta != null && delta !== 0 ? (delta > 0 ? `+${delta}` : `${delta}`) : "—"}
      </span>
    </div>
  );
}

function StatusBadge({ status, progressStep }: { status: string | null; progressStep: string | null }) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return (
    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs gap-1">
      <CheckCircle2 className="w-3 h-3" /> Completed
    </Badge>
  );
  if (s === "failed") return (
    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs gap-1">
      <XCircle className="w-3 h-3" /> Failed
    </Badge>
  );
  if (s === "queued" || s === "running") return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs gap-1">
      <Loader2 className="w-3 h-3 animate-spin" /> {progressStep || "Running"}
    </Badge>
  );
  return <Badge variant="outline" className="text-xs">{status || "Unknown"}</Badge>;
}

// ── Site card ────────────────────────────────────────────────────────────────

function SiteCard({
  site,
  onScanAgain,
  scanningId,
}: {
  site: SiteWithHistory;
  onScanAgain: (siteId: string, siteUrl: string) => void;
  scanningId: string | null;
}) {
  const navigate = useNavigate();
  const completed = site.snapshots.filter((s) => s.status === "completed");
  const latest = site.snapshots[0] ?? null;
  const latestCompleted = completed[0] ?? null;
  const previousCompleted = completed[1] ?? null;

  const cur = latestCompleted?._scores ?? {};
  const prev = previousCompleted?._scores ?? undefined;

  const isScanning = scanningId === site.id;

  return (
    <Card className="border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{site.site_url}</span>
          </div>
          {latest && <StatusBadge status={latest.status} progressStep={latest.progress_step} />}
        </div>

        {/* Meta row */}
        {latest && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {safeDateShort(latest.started_at || latest.finished_at)}
            </span>
            {latestCompleted?._pagesCrawled ? (
              <span>{latestCompleted._pagesCrawled} pages crawled</span>
            ) : null}
            <span>{site.snapshots.length} scan{site.snapshots.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Score trend row */}
        {latestCompleted && (
          <div className="flex items-center gap-4 pt-1">
            <TrendChip label="Opportunity" current={cur.opportunity} previous={prev?.opportunity} />
            <TrendChip label="Structural" current={cur.structural} previous={prev?.structural} />
            <TrendChip label="Visibility" current={cur.visibility} previous={prev?.visibility} />
          </div>
        )}

        {!latestCompleted && site.snapshots.length > 0 && (
          <p className="text-xs text-muted-foreground">No completed scans yet.</p>
        )}

        {site.snapshots.length === 0 && (
          <p className="text-xs text-muted-foreground">No scans run yet.</p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          {latestCompleted && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => navigate(`/seo/results?snapshot=${latestCompleted.id}`)}
            >
              View Results <ChevronRight className="w-3 h-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground"
            disabled={isScanning}
            onClick={() => onScanAgain(site.id, site.site_url)}
          >
            {isScanning ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Scanning…</>
            ) : (
              <><RefreshCw className="w-3 h-3" /> Scan Again</>
            )}
          </Button>
          <a
            href={site.site_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const PAGE_OPTIONS = [8, 25, 50] as const;
type PageOption = typeof PAGE_OPTIONS[number];

const SEO = () => {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [maxPages, setMaxPages] = useState<PageOption>(8);

  const [sites, setSites] = useState<SiteWithHistory[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);

  // ── Load history ──────────────────────────────────────────────────────────

  const loadSites = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: siteRows, error: siteErr } = await (supabase as any)
      .from("scc_sites")
      .select("id, site_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (siteErr || !siteRows?.length) {
      setLoadingSites(false);
      setSites([]);
      return;
    }

    const siteIds = siteRows.map((s: SiteRow) => s.id);

    const { data: snapRows } = await (supabase as any)
      .from("scc_snapshots")
      .select("id, site_id, status, progress_step, started_at, finished_at, notes")
      .in("site_id", siteIds)
      .order("started_at", { ascending: false, nullsFirst: false });

    const snapsBySite: Record<string, SnapshotSummary[]> = {};
    for (const snap of (snapRows || []) as SnapshotSummary[]) {
      if (!snapsBySite[snap.site_id]) snapsBySite[snap.site_id] = [];
      if (snapsBySite[snap.site_id].length < 5) {
        const { scores, pagesCrawled } = parseNotes(snap.notes);
        snapsBySite[snap.site_id].push({ ...snap, _scores: scores, _pagesCrawled: pagesCrawled });
      }
    }

    setSites(siteRows.map((s: SiteRow) => ({ ...s, snapshots: snapsBySite[s.id] || [] })));
    setLoadingSites(false);
  }, []);

  useEffect(() => { void loadSites(); }, [loadSites]);

  // ── New scan ──────────────────────────────────────────────────────────────

  const runScan = useCallback(async (siteId: string | null, siteUrl: string) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError("Not logged in."); return; }

    let resolvedSiteId = siteId;

    if (!resolvedSiteId) {
      const { data: siteRow, error: siteErr } = await (supabase as any)
        .from("scc_sites")
        .upsert({ user_id: user.id, site_url: siteUrl }, { onConflict: "user_id,site_url" })
        .select("id")
        .single();

      if (siteErr || !siteRow?.id) { setError(siteErr?.message || "Failed to create site"); return; }
      resolvedSiteId = siteRow.id;
    }

    setScanningId(resolvedSiteId);

    try {
      const { snapshotId } = await startQueuedSeoScan({
        siteId: resolvedSiteId!,
        seedUrl: siteUrl,
        mode: "seo_intelligence",
        maxPages,
        maxDepth: 1,
      });
      navigate(`/seo/results?snapshot=${snapshotId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to start scan");
      setScanningId(null);
    }
  }, [navigate]);

  const handleNewScan = useCallback(async () => {
    setError(null);
    const trimmed = urlInput.trim();
    if (!trimmed) { setError("Enter a website URL"); return; }
    const normalized = normalizeUrl(trimmed);
    if (!normalized || normalized === "https://") { setError("Please enter a valid URL"); return; }
    setIsSubmitting(true);
    await runScan(null, normalized);
    setIsSubmitting(false);
  }, [urlInput, runScan]);

  const handleScanAgain = useCallback(async (siteId: string, siteUrl: string) => {
    setError(null);
    await runScan(siteId, siteUrl);
    setScanningId(null);
  }, [runScan]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          SEO Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Scan any website to uncover SEO opportunities and track performance over time.</p>
      </div>

      {/* New scan input */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleNewScan()}
              />
            </div>
            <Button onClick={handleNewScan} disabled={isSubmitting || !urlInput.trim()}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</> : "Run Scan"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Pages to crawl:</span>
            <div className="flex gap-1">
              {PAGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxPages(n)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    maxPages === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Your Sites</h2>

        {loadingSites ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading scan history…
          </div>
        ) : sites.length === 0 ? (
          <Card className="border-border border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No sites scanned yet. Enter a URL above to run your first scan.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onScanAgain={handleScanAgain}
                scanningId={scanningId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SEO;
