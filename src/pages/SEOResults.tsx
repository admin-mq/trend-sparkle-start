import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, ArrowLeft, AlertTriangle, CheckCircle2, Info, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

interface SnapshotRow {
  id: string;
  site_id: string;
  status: string;
  started_at: string;
  finished_at: string;
}

interface SiteRow {
  id: string;
  site_url: string;
}

interface PageMetric {
  id: string;
  page_id: string;
  structural_score: number;
  visibility_score: number;
  revenue_score: number;
  paid_risk_score: number;
  page_opportunity_score: number;
  priority_bucket: string;
  impressions: number;
  clicks: number;
  avg_position: number;
  ctr: number;
  page?: { url: string; page_type: string };
}

interface ActionRow {
  id: string;
  title: string;
  why_it_matters: string;
  technical_reason: string;
  expected_impact_range: string;
  steps: string[];
  severity: string;
  page_id: string | null;
}

const severityColor: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const SEOResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const snapshotId = searchParams.get("snapshot");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotRow | null>(null);
  const [site, setSite] = useState<SiteRow | null>(null);
  const [metrics, setMetrics] = useState<PageMetric[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);

  useEffect(() => {
    if (!snapshotId) {
      setError("No snapshot ID provided.");
      setLoading(false);
      return;
    }
    fetchResults(snapshotId);
  }, [snapshotId]);

  async function fetchResults(snapId: string) {
    setLoading(true);
    setError(null);
    try {
      // Fetch snapshot
      const { data: snap, error: snapErr } = await (supabase as any)
        .from("scc_snapshots")
        .select("*")
        .eq("id", snapId)
        .single();
      if (snapErr) throw new Error(snapErr.message);
      setSnapshot(snap);

      // Fetch site
      const { data: siteData, error: siteErr } = await (supabase as any)
        .from("scc_sites")
        .select("*")
        .eq("id", snap.site_id)
        .single();
      if (siteErr) throw new Error(siteErr.message);
      setSite(siteData);

      // Fetch page metrics with page info
      const { data: metricsData, error: metricsErr } = await (supabase as any)
        .from("scc_page_snapshot_metrics")
        .select("*, page:scc_pages(url, page_type)")
        .eq("snapshot_id", snapId)
        .order("page_opportunity_score", { ascending: false });
      if (metricsErr) throw new Error(metricsErr.message);
      setMetrics(metricsData || []);

      // Fetch actions
      const { data: actionsData, error: actionsErr } = await (supabase as any)
        .from("scc_actions")
        .select("*")
        .eq("snapshot_id", snapId);
      if (actionsErr) throw new Error(actionsErr.message);
      const sorted = (actionsData || []).sort(
        (a: ActionRow, b: ActionRow) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
      );
      setActions(sorted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const SeverityIcon = ({ severity }: { severity: string }) => {
    if (severity === "high") return <AlertTriangle className="w-4 h-4" />;
    if (severity === "medium") return <Info className="w-4 h-4" />;
    return <CheckCircle2 className="w-4 h-4" />;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
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
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              {site.site_url}
              {snapshot?.finished_at && (
                <span className="ml-2">
                  · {new Date(snapshot.finished_at).toLocaleString()}
                </span>
              )}
            </p>
          )}
        </div>
        <Button onClick={() => navigate("/seo")} variant="outline" size="sm">
          Run New Scan
        </Button>
      </div>

      {/* Top Opportunities */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Top Opportunities</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.id} className="border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs capitalize">
                    {m.page?.page_type || "page"}
                  </Badge>
                  <Badge
                    className={
                      m.priority_bucket === "high"
                        ? "bg-destructive/15 text-destructive border-destructive/30"
                        : "bg-primary/15 text-primary border-primary/30"
                    }
                    variant="outline"
                  >
                    {m.priority_bucket} priority
                  </Badge>
                </div>
                <CardTitle className="text-sm font-medium mt-2 truncate">
                  {m.page?.url || "Unknown page"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Opportunity</span>
                    <p className="text-lg font-bold text-foreground">{m.page_opportunity_score}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Visibility</span>
                    <p className="text-lg font-bold text-foreground">{m.visibility_score}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Impressions</span>
                    <p className="font-medium text-foreground">{m.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CTR</span>
                    <p className="font-medium text-foreground">{(m.ctr * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Structural</span>
                    <p className="font-medium text-foreground">{m.structural_score}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Position</span>
                    <p className="font-medium text-foreground">{m.avg_position}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recommended Actions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recommended Actions</h2>
        <div className="space-y-3">
          {actions.map((action) => {
            const steps: string[] = Array.isArray(action.steps) ? action.steps : [];
            return (
              <Card key={action.id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${severityColor[action.severity] || ""} text-xs capitalize gap-1`}
                        >
                          <SeverityIcon severity={action.severity} />
                          {action.severity}
                        </Badge>
                        <h3 className="font-semibold text-foreground text-sm">{action.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{action.why_it_matters}</p>
                      <p className="text-xs text-muted-foreground/70 font-mono">{action.technical_reason}</p>
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
      </section>
    </div>
  );
};

export default SEOResults;
