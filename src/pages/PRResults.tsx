import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Megaphone, Loader2, ChevronLeft, CheckCircle2, XCircle,
  AlertTriangle, TrendingUp, Shield, FileText, Lightbulb,
  Globe, RefreshCw, ArrowLeft, Zap, Eye, Play, MessageSquare,
  Bell, TrendingDown, ChevronUp, ChevronDown, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

const SUPABASE_FUNCTIONS_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co/functions/v1";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PrProject {
  id: string;
  brand_name: string;
  domain: string;
  industry: string | null;
  geography: string | null;
  competitors: { name: string; domain: string }[];
  tracked_prompts: { prompt_text: string }[];
}

interface PrScanJob {
  id: string;
  status: string;
  progress_step: string | null;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
}

interface BrandNarrative {
  theme: string;
  strength: number;
  description: string;
  status: "strong" | "emerging" | "weak" | "missing";
}

interface CompetitorNarrative {
  theme: string;
  strength: number;
  description: string;
}

interface ProofGap {
  gap_type: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  narrative_affected: string;
}

interface RecommendedAction {
  title: string;
  action_type: string;
  priority: number;
  effort: "low" | "medium" | "high";
  expected_impact: "low" | "medium" | "high";
  why_it_matters: string;
  what_to_do: string;
}

interface NarrativeResult {
  narrative_score: number | null;
  authority_score: number | null;
  proof_density_score: number | null;
  risk_score: number | null;
  opportunity_score: number | null;
  brand_narratives: BrandNarrative[];
  competitor_narratives: Record<string, CompetitorNarrative[]>;
  proof_gaps: ProofGap[];
  recommended_actions: RecommendedAction[];
  executive_summary: string | null;
  pages_analyzed: number;
}

interface VisibilityRun {
  id: string;
  status: string;
  progress: number;
  total: number;
  error: string | null;
  created_at: string;
  ended_at: string | null;
}

interface VisibilityResult {
  id: string;
  prompt_text: string;
  geography: string | null;
  brand_present: boolean;
  brand_position: number | null;
  brand_context: string | null;
  competitor_presence: Record<string, boolean>;
  cited_domains: string[];
  raw_answer: string | null;
  why_absent: string | null;
  analysis_summary: string | null;
  visibility_score: number;
}

interface ScoreSnapshot {
  id: string;
  narrative_score: number | null;
  authority_score: number | null;
  proof_density_score: number | null;
  risk_score: number | null;
  opportunity_score: number | null;
  snapshot_date: string;
}

interface PrAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  metric_name: string | null;
  metric_label: string | null;
  previous_value: number | null;
  current_value: number | null;
  delta_value: number | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const POLL_MS = 3500;

function scoreColor(score: number | null, invert = false): string {
  if (score == null) return "text-muted-foreground";
  const s = invert ? 100 - score : score;
  if (s >= 70) return "text-emerald-400";
  if (s >= 40) return "text-yellow-400";
  return "text-destructive";
}

function scoreRing(score: number | null, invert = false): string {
  if (score == null) return "border-muted";
  const s = invert ? 100 - score : score;
  if (s >= 70) return "border-emerald-500/50";
  if (s >= 40) return "border-yellow-500/50";
  return "border-destructive/50";
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/30",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return map[severity] || map.low;
}

function effortBadge(effort: string) {
  const map: Record<string, string> = {
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };
  return map[effort] || "";
}

function impactBadge(impact: string) {
  const map: Record<string, string> = {
    high: "bg-primary/10 text-primary border-primary/30",
    medium: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return map[impact] || "";
}

function narrativeStatusBadge(status: string) {
  const map: Record<string, string> = {
    strong: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    emerging: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    weak: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    missing: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return map[status] || "";
}

function actionTypeBadge(type: string) {
  const map: Record<string, string> = {
    content: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    pr: "bg-primary/10 text-primary border-primary/30",
    page: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    authority: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    proof: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  };
  return map[type] || "bg-muted text-muted-foreground border-border";
}

// ── Score card ────────────────────────────────────────────────────────────────

function ScoreDelta({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta == null || delta === 0) return null;
  // For invert=true (risk), going up is bad so we flip colour
  const isGood = invert ? delta < 0 : delta > 0;
  const abs = Math.abs(delta);
  return (
    <div className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isGood ? "text-emerald-400" : "text-destructive"}`}>
      {isGood ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {abs}
    </div>
  );
}

function ScoreCard({
  label, score, icon: Icon, invert = false, subtitle, delta,
}: {
  label: string;
  score: number | null;
  icon: React.ElementType;
  invert?: boolean;
  subtitle?: string;
  delta?: number | null;
}) {
  return (
    <Card className={`border-2 ${scoreRing(score, invert)}`}>
      <CardContent className="p-4 text-center space-y-2">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mx-auto">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className={`text-3xl font-bold ${scoreColor(score, invert)}`}>
          {score != null ? score : "—"}
        </div>
        <div className="text-xs font-medium text-foreground">{label}</div>
        {delta != null && delta !== 0 && (
          <div className="flex items-center justify-center gap-1">
            <ScoreDelta delta={delta} invert={invert} />
            <span className="text-xs text-muted-foreground">vs last scan</span>
          </div>
        )}
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

// ── Strength bar ──────────────────────────────────────────────────────────────

function StrengthBar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-secondary rounded-full h-1.5">
      <div
        className={`${color} h-1.5 rounded-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PRResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  const [project, setProject] = useState<PrProject | null>(null);
  const [job, setJob] = useState<PrScanJob | null>(null);
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Visibility state
  const [visibilityRun, setVisibilityRun] = useState<VisibilityRun | null>(null);
  const [visibilityResults, setVisibilityResults] = useState<VisibilityResult[]>([]);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [startingVisibility, setStartingVisibility] = useState(false);

  // Score history + alerts
  const [scoreHistory, setScoreHistory] = useState<ScoreSnapshot[]>([]);
  const [alerts, setAlerts] = useState<PrAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!projectId) return;

    const { data: proj } = await (supabase as any)
      .from("pr_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!proj) { setError("Project not found"); setLoading(false); return; }
    setProject(proj);

    // Latest job
    const { data: latestJob } = await (supabase as any)
      .from("pr_scan_jobs")
      .select("id, status, progress_step, started_at, ended_at, error_message")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    setJob(latestJob || null);

    if (latestJob?.status === "completed") {
      const { data: res } = await (supabase as any)
        .from("pr_narrative_results")
        .select("*")
        .eq("scan_job_id", latestJob.id)
        .single();
      setResult(res || null);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Poll while narrative scan running
  useEffect(() => {
    if (!job || (job.status !== "running" && job.status !== "queued")) return;
    const interval = setInterval(() => void loadData(), POLL_MS);
    return () => clearInterval(interval);
  }, [job, loadData]);

  // ── Visibility ─────────────────────────────────────────────────────────────

  const loadVisibility = useCallback(async () => {
    if (!projectId) return;

    const { data: run } = await (supabase as any)
      .from("pr_visibility_runs")
      .select("id, status, progress, total, error, created_at, ended_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    setVisibilityRun(run || null);

    if (run?.status === "completed") {
      const { data: results } = await (supabase as any)
        .from("pr_visibility_results")
        .select("*")
        .eq("run_id", run.id)
        .order("created_at", { ascending: true });
      setVisibilityResults(results || []);
    } else {
      setVisibilityResults([]);
    }
  }, [projectId]);

  useEffect(() => { void loadVisibility(); }, [loadVisibility]);

  // Poll while visibility check running
  useEffect(() => {
    if (!visibilityRun || (visibilityRun.status !== "running" && visibilityRun.status !== "queued")) return;
    const interval = setInterval(() => void loadVisibility(), POLL_MS);
    return () => clearInterval(interval);
  }, [visibilityRun, loadVisibility]);

  // ── Score history + alerts ─────────────────────────────────────────────────

  const loadHistoryAndAlerts = useCallback(async () => {
    if (!projectId) return;

    const [historyRes, alertsRes] = await Promise.all([
      (supabase as any)
        .from("pr_score_history")
        .select("id, narrative_score, authority_score, proof_density_score, risk_score, opportunity_score, snapshot_date")
        .eq("project_id", projectId)
        .order("snapshot_date", { ascending: false })
        .limit(10),
      (supabase as any)
        .from("pr_alerts")
        .select("*")
        .eq("project_id", projectId)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const history: ScoreSnapshot[] = historyRes.data || [];
    const alertList: PrAlert[] = alertsRes.data || [];

    setScoreHistory(history);
    setAlerts(alertList);
    setUnreadCount(alertList.filter((a) => !a.read_at).length);
  }, [projectId]);

  useEffect(() => { void loadHistoryAndAlerts(); }, [loadHistoryAndAlerts]);

  const markAlertsRead = useCallback(async () => {
    if (!projectId || unreadCount === 0) return;
    await (supabase as any)
      .from("pr_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .is("read_at", null);
    setAlerts((prev) => prev.map((a) => ({ ...a, read_at: a.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  }, [projectId, unreadCount]);

  const dismissAlert = useCallback(async (alertId: string) => {
    await (supabase as any)
      .from("pr_alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Compute deltas from score history (latest vs previous)
  const prevSnapshot = scoreHistory.length >= 2 ? scoreHistory[1] : null;
  const scoreDelta = (key: keyof ScoreSnapshot) => {
    if (!result || !prevSnapshot) return null;
    const curr = result[key as keyof NarrativeResult] as number | null;
    const prev = prevSnapshot[key] as number | null;
    if (curr == null || prev == null) return null;
    return curr - prev;
  };

  const runVisibilityCheck = useCallback(async () => {
    if (!project) return;
    setStartingVisibility(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data: run, error: runErr } = await (supabase as any)
        .from("pr_visibility_runs")
        .insert({ project_id: project.id, status: "queued" })
        .select("id")
        .single();

      if (runErr || !run) throw new Error(runErr?.message || "Failed to create run");

      fetch(`${SUPABASE_FUNCTIONS_URL}/pr-visibility-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ project_id: project.id, run_id: run.id }),
      }).catch(console.error);

      toast({ title: "Visibility check started", description: `Checking ${project.tracked_prompts?.length || 0} prompts…` });
      await loadVisibility();
    } catch (e: any) {
      toast({ title: "Failed to start check", description: e?.message, variant: "destructive" });
    } finally {
      setStartingVisibility(false);
    }
  }, [project, loadVisibility]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (!projectId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No project selected. <Button variant="link" onClick={() => navigate("/pr")}>Go back</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-destructive">{error || "Project not found"}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/pr")}>Go back</Button>
      </div>
    );
  }

  // Scanning in progress
  if (!job || job.status === "queued" || job.status === "running") {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pr")} className="gap-1 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
        <Card className="border-primary/30">
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <div>
              <p className="font-semibold text-foreground">Analysing {project.brand_name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {job?.progress_step || "Fetching pages and extracting narratives…"}
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Crawling brand and competitor websites</p>
              <p>Extracting narrative signals with AI</p>
              <p>Identifying proof gaps and opportunities</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Failed
  if (job.status === "failed") {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/pr")} className="gap-1 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-3">
            <XCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-foreground">Analysis failed</p>
            {job.error_message && <p className="text-sm text-muted-foreground">{job.error_message}</p>}
            <Button size="sm" variant="outline" onClick={() => navigate("/pr")}>
              Go back and retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No result (shouldn't happen but safe)
  if (!result) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No results available. <Button variant="link" onClick={() => navigate("/pr")}>Go back</Button>
      </div>
    );
  }

  const competitors = project.competitors || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 text-muted-foreground" onClick={() => navigate("/pr")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              {project.brand_name}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Globe className="w-3 h-3" /> {project.domain}
              {result.pages_analyzed > 0 && <span>· {result.pages_analyzed} pages analysed</span>}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={() => navigate("/pr")}>
          <RefreshCw className="w-3.5 h-3.5" /> Re-analyse
        </Button>
      </div>

      {/* Executive summary */}
      {result.executive_summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-foreground leading-relaxed">{result.executive_summary}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="narratives">Narrative Map</TabsTrigger>
          <TabsTrigger value="gaps">Proof Gaps</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="visibility" className="gap-1.5">
            <Eye className="w-3.5 h-3.5" /> AI Visibility
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 relative" onClick={markAlertsRead}>
            <Bell className="w-3.5 h-3.5" /> Alerts
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ScoreCard label="Narrative" score={result.narrative_score} icon={TrendingUp} subtitle="How strong & consistent" delta={scoreDelta("narrative_score")} />
            <ScoreCard label="Authority" score={result.authority_score} icon={Shield} subtitle="How credible you appear" delta={scoreDelta("authority_score")} />
            <ScoreCard label="Proof Density" score={result.proof_density_score} icon={FileText} subtitle="Evidence behind claims" delta={scoreDelta("proof_density_score")} />
            <ScoreCard label="Risk" score={result.risk_score} icon={AlertTriangle} invert subtitle="Lower is better" delta={scoreDelta("risk_score")} />
            <ScoreCard label="Opportunity" score={result.opportunity_score} icon={Zap} subtitle="Room to gain ground" delta={scoreDelta("opportunity_score")} />
          </div>

          {/* Top gaps preview */}
          {result.proof_gaps.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Top Proof Gaps</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {result.proof_gaps.slice(0, 3).map((gap, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Badge variant="outline" className={`text-xs shrink-0 mt-0.5 ${severityBadge(gap.severity)}`}>
                      {gap.severity}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">{gap.gap_type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{gap.description}</p>
                    </div>
                  </div>
                ))}
                {result.proof_gaps.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{result.proof_gaps.length - 3} more gaps in the Proof Gaps tab</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top actions preview */}
          {result.recommended_actions.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Top Recommended Actions</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {result.recommended_actions.slice(0, 3).map((action, i) => (
                  <div key={i} className="flex items-start gap-3 py-1">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.why_it_matters}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={`text-xs ${effortBadge(action.effort)}`}>{action.effort} effort</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Narrative Map ─────────────────────────────────────────────────── */}
        <TabsContent value="narratives" className="space-y-5 mt-4">
          {/* Brand narratives */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {project.brand_name} — Narrative Themes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {result.brand_narratives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No narratives extracted.</p>
              ) : (
                result.brand_narratives.map((n, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{n.theme}</span>
                        <Badge variant="outline" className={`text-xs ${narrativeStatusBadge(n.status)}`}>
                          {n.status}
                        </Badge>
                      </div>
                      <span className="text-xs font-bold text-foreground">{n.strength}</span>
                    </div>
                    <StrengthBar value={n.strength} color={
                      n.status === "strong" ? "bg-emerald-500"
                        : n.status === "emerging" ? "bg-blue-500"
                        : n.status === "weak" ? "bg-yellow-500"
                        : "bg-destructive"
                    } />
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Competitor narratives */}
          {competitors.length > 0 && Object.keys(result.competitor_narratives).length > 0 && (
            <>
              {competitors.map((comp) => {
                const compNarratives = result.competitor_narratives[comp.domain] || [];
                if (compNarratives.length === 0) return null;
                return (
                  <Card key={comp.domain}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        {comp.name || comp.domain}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-4">
                      {compNarratives.map((n, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{n.theme}</span>
                            <span className="text-xs font-bold text-muted-foreground">{n.strength}</span>
                          </div>
                          <StrengthBar value={n.strength} color="bg-secondary-foreground/30" />
                          <p className="text-xs text-muted-foreground">{n.description}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* ── Proof Gaps ───────────────────────────────────────────────────── */}
        <TabsContent value="gaps" className="space-y-3 mt-4">
          {result.proof_gaps.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium">No major proof gaps detected</p>
                <p className="text-xs text-muted-foreground mt-1">Your brand shows strong proof and trust signals.</p>
              </CardContent>
            </Card>
          ) : (
            result.proof_gaps.map((gap, i) => (
              <Card key={i} className={`border-l-4 ${
                gap.severity === "critical" ? "border-l-destructive"
                  : gap.severity === "high" ? "border-l-orange-500"
                  : gap.severity === "medium" ? "border-l-yellow-500"
                  : "border-l-muted-foreground"
              }`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-sm text-foreground">{gap.gap_type}</p>
                    <Badge variant="outline" className={`text-xs shrink-0 ${severityBadge(gap.severity)}`}>
                      {gap.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{gap.description}</p>
                  {gap.narrative_affected && (
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">Affects: </span>
                      {gap.narrative_affected}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <TabsContent value="actions" className="space-y-3 mt-4">
          {result.recommended_actions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Lightbulb className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium">No actions generated</p>
              </CardContent>
            </Card>
          ) : (
            result.recommended_actions.map((action, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="font-medium text-sm text-foreground">{action.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <Badge variant="outline" className={`text-xs ${actionTypeBadge(action.action_type)}`}>
                        {action.action_type}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground pl-9">{action.why_it_matters}</p>

                  {action.what_to_do && (
                    <div className="pl-9 space-y-1">
                      <p className="text-xs font-medium text-foreground">What to do:</p>
                      <p className="text-xs text-muted-foreground">{action.what_to_do}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pl-9 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${effortBadge(action.effort)}`}>
                      {action.effort} effort
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${impactBadge(action.expected_impact)}`}>
                      {action.expected_impact} impact
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        {/* ── Alerts ───────────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Score change alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generated automatically after each scan — shows what moved and why
              </p>
            </div>
            {alerts.length > 0 && (
              <p className="text-xs text-muted-foreground">{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</p>
            )}
          </div>

          {alerts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-2">
                <Bell className="w-7 h-7 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">No alerts yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Alerts appear after your second scan, comparing scores and surfacing significant changes.
                </p>
              </CardContent>
            </Card>
          )}

          {alerts.map((alert) => {
            const severityStyle: Record<string, string> = {
              critical: "border-l-destructive bg-destructive/5",
              high:     "border-l-orange-500 bg-orange-500/5",
              medium:   "border-l-yellow-500 bg-yellow-500/5",
              low:      "border-l-border bg-muted/30",
              positive: "border-l-emerald-500 bg-emerald-500/5",
            };
            const badgeStyle: Record<string, string> = {
              critical: "bg-destructive/10 text-destructive border-destructive/30",
              high:     "bg-orange-500/10 text-orange-400 border-orange-500/30",
              medium:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
              low:      "bg-muted text-muted-foreground border-border",
              positive: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
            };
            const isUnread = !alert.read_at;

            return (
              <Card
                key={alert.id}
                className={`border-l-4 ${severityStyle[alert.severity] || severityStyle.low} ${isUnread ? "ring-1 ring-primary/20" : ""}`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{alert.title}</p>
                        {alert.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs capitalize ${badgeStyle[alert.severity] || ""}`}>
                        {alert.severity === "positive" ? "positive" : alert.severity}
                      </Badge>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Delta display */}
                  {alert.delta_value != null && alert.metric_label && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-xs text-muted-foreground">{alert.metric_label}:</span>
                      <span className="text-xs font-medium text-muted-foreground">{alert.previous_value}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-xs font-bold text-foreground">{alert.current_value}</span>
                      <span className={`text-xs font-semibold flex items-center gap-0.5 ${
                        alert.severity === "positive" ? "text-emerald-400" : "text-destructive"
                      }`}>
                        {alert.delta_value > 0
                          ? <><ChevronUp className="w-3 h-3" />{alert.delta_value}</>
                          : <><ChevronDown className="w-3 h-3" />{Math.abs(alert.delta_value)}</>
                        }
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── AI Visibility ────────────────────────────────────────────── */}
        <TabsContent value="visibility" className="space-y-4 mt-4">
          {/* No prompts configured */}
          {(!project.tracked_prompts || project.tracked_prompts.length === 0) ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="font-medium text-foreground">No prompts tracked</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Add prompts to your project (e.g. "best PR tool for startups") to check if your brand appears in AI answers.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {project.tracked_prompts.length} prompt{project.tracked_prompts.length !== 1 ? "s" : ""} tracked
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Checks whether your brand appears when buyers ask AI tools these questions
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={startingVisibility || visibilityRun?.status === "running" || visibilityRun?.status === "queued"}
                  onClick={runVisibilityCheck}
                >
                  {startingVisibility || visibilityRun?.status === "running" || visibilityRun?.status === "queued" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {visibilityRun?.total ? `${visibilityRun.progress ?? 0}/${visibilityRun.total}` : "Checking…"}
                    </>
                  ) : (
                    <><Play className="w-3.5 h-3.5" /> {visibilityRun ? "Re-check" : "Run Check"}</>
                  )}
                </Button>
              </div>

              {/* Running state */}
              {(visibilityRun?.status === "running" || visibilityRun?.status === "queued") && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Checking AI visibility…</p>
                      <p className="text-xs text-muted-foreground">
                        Asking GPT-4o each prompt and analysing brand presence.
                        {visibilityRun.total > 0 && ` ${visibilityRun.progress ?? 0} of ${visibilityRun.total} done.`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No run yet */}
              {!visibilityRun && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center space-y-2">
                    <Eye className="w-7 h-7 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Hit "Run Check" to see if your brand appears in AI answers.</p>
                  </CardContent>
                </Card>
              )}

              {/* Results */}
              {visibilityResults.length > 0 && (
                <>
                  {/* Overall score */}
                  {(() => {
                    const avg = Math.round(visibilityResults.reduce((s, r) => s + (r.visibility_score ?? 0), 0) / visibilityResults.length);
                    const present = visibilityResults.filter((r) => r.brand_present).length;
                    return (
                      <Card className={`border-2 ${avg >= 50 ? "border-emerald-500/30" : avg >= 25 ? "border-yellow-500/30" : "border-destructive/30"}`}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="text-center">
                            <div className={`text-3xl font-bold ${avg >= 50 ? "text-emerald-400" : avg >= 25 ? "text-yellow-400" : "text-destructive"}`}>{avg}</div>
                            <div className="text-xs text-muted-foreground">Avg visibility score</div>
                          </div>
                          <div className="h-10 w-px bg-border" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {present} of {visibilityResults.length} prompts — brand present
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {present === 0
                                ? "Your brand doesn't appear in any AI answers for these prompts."
                                : present === visibilityResults.length
                                ? "Your brand appears across all tracked prompts."
                                : `Missing from ${visibilityResults.length - present} prompt${visibilityResults.length - present !== 1 ? "s" : ""}.`}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Per-prompt cards */}
                  {visibilityResults.map((r, i) => (
                    <Card key={i} className={`border-l-4 ${r.brand_present ? "border-l-emerald-500" : "border-l-destructive"}`}>
                      <CardContent className="p-4 space-y-3">
                        {/* Prompt + presence badge */}
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">"{r.prompt_text}"</p>
                          <Badge variant="outline" className={`shrink-0 text-xs gap-1 ${
                            r.brand_present
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}>
                            {r.brand_present ? <><CheckCircle2 className="w-3 h-3" /> Present</> : <><XCircle className="w-3 h-3" /> Absent</>}
                          </Badge>
                        </div>

                        {/* Summary */}
                        {r.analysis_summary && (
                          <p className="text-xs text-muted-foreground">{r.analysis_summary}</p>
                        )}

                        {/* Brand context quote */}
                        {r.brand_present && r.brand_context && (
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2.5">
                            <p className="text-xs text-emerald-300 italic">"{r.brand_context}"</p>
                          </div>
                        )}

                        {/* Why absent */}
                        {!r.brand_present && r.why_absent && (
                          <div className="bg-destructive/5 border border-destructive/20 rounded p-2.5">
                            <p className="text-xs text-destructive/80">{r.why_absent}</p>
                          </div>
                        )}

                        {/* Competitors + cited domains */}
                        <div className="flex flex-wrap gap-3 pt-1">
                          {/* Competitor presence */}
                          {Object.entries(r.competitor_presence || {}).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Competitors in answer:</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(r.competitor_presence).map(([domain, present]) => (
                                  <Badge key={domain} variant="outline" className={`text-xs ${
                                    present
                                      ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                      : "bg-muted text-muted-foreground"
                                  }`}>
                                    {present ? "✓" : "✗"} {domain}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cited domains */}
                          {r.cited_domains?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Domains cited:</p>
                              <div className="flex flex-wrap gap-1">
                                {r.cited_domains.slice(0, 6).map((d) => (
                                  <Badge key={d} variant="outline" className="text-xs bg-muted text-muted-foreground">
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Score + geography */}
                        <div className="flex items-center gap-3 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Score:</span>
                            <span className={`text-xs font-bold ${
                              r.visibility_score >= 50 ? "text-emerald-400"
                              : r.visibility_score >= 25 ? "text-yellow-400"
                              : "text-destructive"
                            }`}>{r.visibility_score}/100</span>
                          </div>
                          {r.geography && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" /> {r.geography}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PRResults;
