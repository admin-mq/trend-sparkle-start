import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PROnboarding } from "@/components/PROnboarding";
import {
  Megaphone, Plus, Globe, Loader2, CheckCircle2, XCircle, Clock,
  ChevronRight, AlertCircle, Building2, Target, Users, MapPin, Trash2, RefreshCw,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Competitor {
  name: string;
  domain: string;
}

interface PrProject {
  id: string;
  brand_name: string;
  domain: string;
  industry: string | null;
  geography: string | null;
  competitors: Competitor[];
  created_at: string;
}

interface PrScanJob {
  id: string;
  project_id: string;
  status: string;
  progress_step: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface ScoreSnapshot {
  narrative_score: number;
  authority_score: number;
  proof_density_score: number;
  opportunity_score: number;
  snapshot_date: string;
}

interface ProjectWithJob extends PrProject {
  latest_job: PrScanJob | null;
  latest_scores: ScoreSnapshot | null;
  prev_scores: ScoreSnapshot | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDomain(raw: string): string {
  let s = raw.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return s;
}

function safeDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status, step }: { status: string; step: string | null }) {
  const s = status.toLowerCase();
  if (s === "completed") return (
    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs gap-1">
      <CheckCircle2 className="w-3 h-3" /> Analysed
    </Badge>
  );
  if (s === "failed") return (
    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs gap-1">
      <XCircle className="w-3 h-3" /> Failed
    </Badge>
  );
  if (s === "running" || s === "queued") return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs gap-1">
      <Loader2 className="w-3 h-3 animate-spin" /> {step || "Analysing…"}
    </Badge>
  );
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

// ── Project card ──────────────────────────────────────────────────────────────

// ── Score mini-cell with delta arrow ─────────────────────────────────────────

function ScorePill({
  label,
  value,
  prev,
}: {
  label: string;
  value: number;
  prev: number | null;
}) {
  const delta = prev != null ? value - prev : null;
  const scoreColor =
    value >= 75 ? "text-emerald-400" :
    value >= 55 ? "text-yellow-400" :
    "text-red-400";

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className={`text-base font-bold tabular-nums ${scoreColor}`}>{value}</span>
      {delta != null && Math.abs(delta) >= 1 ? (
        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {delta > 0
            ? <TrendingUp className="w-2.5 h-2.5" />
            : <TrendingDown className="w-2.5 h-2.5" />
          }
          {delta > 0 ? "+" : ""}{delta}
        </span>
      ) : delta != null ? (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Minus className="w-2.5 h-2.5" /> 0
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">—</span>
      )}
      <span className="text-[9px] text-muted-foreground leading-tight text-center">{label}</span>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onRunScan,
  isScanning,
}: {
  project: ProjectWithJob;
  onRunScan: (project: PrProject) => void;
  isScanning: boolean;
}) {
  const navigate = useNavigate();
  const job = project.latest_job;
  const canViewResults = job?.status === "completed";
  const isActive = job?.status === "running" || job?.status === "queued";
  const s = project.latest_scores;
  const p = project.prev_scores;

  return (
    <Card
      className="border-border hover:border-primary/40 transition-colors cursor-pointer group"
      onClick={() => canViewResults && navigate(`/pr/results?project=${project.id}`)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
              {project.brand_name}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Globe className="w-3 h-3" /> {project.domain}
            </p>
          </div>
          {job && <StatusBadge status={job.status} step={job.progress_step} />}
        </div>

        {/* Score grid — shown when scores exist */}
        {s ? (
          <div className="grid grid-cols-4 gap-1 py-2 px-1 rounded-lg bg-muted/30 border border-border/50">
            <ScorePill label="Narrative" value={s.narrative_score} prev={p?.narrative_score ?? null} />
            <ScorePill label="Authority" value={s.authority_score} prev={p?.authority_score ?? null} />
            <ScorePill label="Proof" value={s.proof_density_score} prev={p?.proof_density_score ?? null} />
            <ScorePill label="Opportunity" value={s.opportunity_score} prev={p?.opportunity_score ?? null} />
          </div>
        ) : (
          /* No scores yet — show meta info instead */
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {project.industry && (
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {project.industry}</span>
            )}
            {project.geography && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {project.geography}</span>
            )}
            {project.competitors?.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {project.competitors.length} competitor{project.competitors.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Scan date + meta row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {job ? (
              <><Clock className="w-3 h-3" />
                {job.status === "completed"
                  ? `Scanned ${safeDateShort(job.ended_at)}`
                  : isActive ? "Scanning now…"
                  : `Started ${safeDateShort(job.started_at || job.created_at)}`}
              </>
            ) : (
              "No analysis yet"
            )}
          </span>
          {s && project.competitors?.length > 0 && (
            <span className="flex items-center gap-1 opacity-60">
              <Users className="w-3 h-3" /> {project.competitors.length}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
          {canViewResults && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => navigate(`/pr/results?project=${project.id}`)}
            >
              View Results <ChevronRight className="w-3 h-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant={job ? "ghost" : "default"}
            className="h-7 text-xs gap-1"
            disabled={isScanning || isActive}
            onClick={() => onRunScan(project)}
          >
            {isActive ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Analysing…</>
            ) : isScanning ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Starting…</>
            ) : job ? (
              <><RefreshCw className="w-3 h-3" /> Re-analyse</>
            ) : (
              "Run Analysis"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create project dialog ─────────────────────────────────────────────────────

const STEPS = ["Brand", "Competitors", "Prompts"] as const;
type Step = typeof STEPS[number];

function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: PrProject) => void;
}) {
  const [step, setStep] = useState<Step>("Brand");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Brand step
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [geography, setGeography] = useState("Global");
  const [audience, setAudience] = useState("");

  // Competitors step
  const [competitors, setCompetitors] = useState<Competitor[]>([{ name: "", domain: "" }]);

  // Prompts step
  const [promptText, setPromptText] = useState("");
  const [scanFrequency, setScanFrequency] = useState<"weekly" | "monthly" | "manual">("weekly");

  function resetForm() {
    setStep("Brand");
    setBrandName(""); setDomain(""); setIndustry(""); setGeography("Global"); setAudience("");
    setCompetitors([{ name: "", domain: "" }]);
    setPromptText(""); setScanFrequency("weekly");
    setPromptText("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function addCompetitor() {
    if (competitors.length < 4) {
      setCompetitors([...competitors, { name: "", domain: "" }]);
    }
  }

  function removeCompetitor(i: number) {
    setCompetitors(competitors.filter((_, idx) => idx !== i));
  }

  function updateCompetitor(i: number, field: "name" | "domain", value: string) {
    const updated = [...competitors];
    updated[i] = { ...updated[i], [field]: value };
    setCompetitors(updated);
  }

  function validateBrand(): string | null {
    if (!brandName.trim()) return "Brand name is required";
    if (!domain.trim()) return "Domain is required";
    return null;
  }

  function nextStep() {
    setError(null);
    if (step === "Brand") {
      const err = validateBrand();
      if (err) { setError(err); return; }
      setStep("Competitors");
    } else if (step === "Competitors") {
      setStep("Prompts");
    }
  }

  function prevStep() {
    setError(null);
    if (step === "Competitors") setStep("Brand");
    else if (step === "Prompts") setStep("Competitors");
  }

  async function handleCreate() {
    const err = validateBrand();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const validCompetitors = competitors
        .filter((c) => c.domain.trim())
        .map((c) => ({ name: c.name.trim() || c.domain.trim(), domain: normalizeDomain(c.domain) }));

      const trackedPrompts = promptText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((p) => ({ prompt_text: p, geography: geography || "Global" }));

      const { data: project, error: projErr } = await (supabase as any)
        .from("pr_projects")
        .insert({
          user_id: user.id,
          brand_name: brandName.trim(),
          domain: normalizeDomain(domain),
          industry: industry.trim() || null,
          geography: geography.trim() || "Global",
          target_audience: audience.trim() || null,
          competitors: validCompetitors,
          tracked_prompts: trackedPrompts,
          scan_frequency: scanFrequency,
        })
        .select()
        .single();

      if (projErr || !project) throw new Error(projErr?.message || "Failed to create project");

      handleClose();
      onCreated(project);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            New Narrative Analysis
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < stepIndex ? "bg-emerald-500 text-white"
                  : i === stepIndex ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {i < stepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs ${i === stepIndex ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-4 py-1">
          {step === "Brand" && (
            <>
              <div className="space-y-1.5">
                <Label>Brand name *</Label>
                <Input placeholder="Acme Inc." value={brandName} onChange={(e) => setBrandName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Website domain *</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="acme.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Input placeholder="SaaS, Agency, eComm…" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Geography</Label>
                  <Input placeholder="Global, UK, US…" value={geography} onChange={(e) => setGeography(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Target audience</Label>
                <Input placeholder="e.g. B2B SaaS founders, 50-500 employees" value={audience} onChange={(e) => setAudience(e.target.value)} />
              </div>
            </>
          )}

          {step === "Competitors" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Add up to 4 competitors to benchmark your narrative against.</p>
              {competitors.map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <Input placeholder="Competitor name" value={c.name} onChange={(e) => updateCompetitor(i, "name", e.target.value)} />
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input className="pl-8 text-sm h-8" placeholder="competitor.com" value={c.domain} onChange={(e) => updateCompetitor(i, "domain", e.target.value)} />
                    </div>
                  </div>
                  {competitors.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 mt-1 text-muted-foreground" onClick={() => removeCompetitor(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {competitors.length < 4 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={addCompetitor}>
                  <Plus className="w-3 h-3" /> Add another
                </Button>
              )}
            </div>
          )}

          {step === "Prompts" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Target className="w-4 h-4" /> AI prompts to track
              </Label>
              <p className="text-xs text-muted-foreground">
                Enter prompts buyers might ask AI tools, one per line. We'll check if your brand appears.
              </p>
              <Textarea
                rows={5}
                className="text-sm"
                placeholder={"best influencer marketing agency UK\ntop carbon accounting software for SMEs\nleading PR tool for startups"}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Optional — you can add prompts later.</p>

              {/* Scan frequency */}
              <div className="pt-2 space-y-2 border-t border-border">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Clock className="w-4 h-4" /> Rescan frequency
                </Label>
                <p className="text-xs text-muted-foreground">
                  How often should we automatically re-analyse this brand?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["weekly", "monthly", "manual"] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setScanFrequency(freq)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        scanFrequency === freq
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {freq === "weekly" ? "Weekly" : freq === "monthly" ? "Monthly" : "Manual only"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {stepIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={prevStep} disabled={saving}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step !== "Prompts" ? (
            <Button size="sm" onClick={nextStep}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : "Create & Analyse"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SUPABASE_FUNCTIONS_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co/functions/v1";
const POLL_MS = 3000;

const PR = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // ── Load projects + latest job ─────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: projectRows } = await (supabase as any)
      .from("pr_projects")
      .select("id, brand_name, domain, industry, geography, competitors, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!projectRows?.length) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const projectIds = projectRows.map((p: PrProject) => p.id);

    const [{ data: jobRows }, { data: scoreRows }] = await Promise.all([
      (supabase as any)
        .from("pr_scan_jobs")
        .select("id, project_id, status, progress_step, started_at, ended_at, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("pr_score_history")
        .select("project_id, narrative_score, authority_score, proof_density_score, opportunity_score, snapshot_date")
        .in("project_id", projectIds)
        .order("snapshot_date", { ascending: false }),
    ]);

    const latestByProject: Record<string, PrScanJob> = {};
    for (const job of (jobRows || []) as PrScanJob[]) {
      if (!latestByProject[job.project_id]) {
        latestByProject[job.project_id] = job;
      }
    }

    // Keep latest 2 score snapshots per project
    const scoresByProject: Record<string, ScoreSnapshot[]> = {};
    for (const row of (scoreRows || []) as (ScoreSnapshot & { project_id: string })[]) {
      if (!scoresByProject[row.project_id]) scoresByProject[row.project_id] = [];
      if (scoresByProject[row.project_id].length < 2) scoresByProject[row.project_id].push(row);
    }

    const combined: ProjectWithJob[] = projectRows.map((p: PrProject) => ({
      ...p,
      latest_job: latestByProject[p.id] || null,
      latest_scores: scoresByProject[p.id]?.[0] ?? null,
      prev_scores: scoresByProject[p.id]?.[1] ?? null,
    }));

    setProjects(combined);
    setLoading(false);

    // Track any active jobs for polling
    const activeIds = new Set(
      combined
        .filter((p) => p.latest_job?.status === "running" || p.latest_job?.status === "queued")
        .map((p) => p.id)
    );
    setPollingIds(activeIds);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  // ── Polling ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pollingIds.size === 0) return;
    const interval = setInterval(() => void loadProjects(), POLL_MS);
    return () => clearInterval(interval);
  }, [pollingIds, loadProjects]);

  // ── Trigger scan ───────────────────────────────────────────────────────────

  const runScan = useCallback(async (project: PrProject) => {
    setScanningId(project.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Create scan job
      const { data: job, error: jobErr } = await (supabase as any)
        .from("pr_scan_jobs")
        .insert({ project_id: project.id, status: "queued" })
        .select("id")
        .single();

      if (jobErr || !job) throw new Error(jobErr?.message || "Failed to create scan job");

      // Call edge function (fire-and-forget — it will update the job)
      fetch(`${SUPABASE_FUNCTIONS_URL}/pr-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ project_id: project.id, scan_job_id: job.id }),
      }).catch(console.error);

      toast({ title: "Analysis started", description: `Scanning ${project.domain}…` });
      await loadProjects();
      setPollingIds((prev) => new Set([...prev, project.id]));
      navigate(`/pr/results?project=${project.id}`);
    } catch (e: any) {
      toast({ title: "Failed to start analysis", description: e?.message, variant: "destructive" });
    } finally {
      setScanningId(null);
    }
  }, [navigate, loadProjects]);

  // ── After project created ──────────────────────────────────────────────────

  const handleProjectCreated = useCallback(async (project: PrProject) => {
    toast({ title: "Project created!", description: "Starting your first analysis now…" });
    await loadProjects();
    await runScan(project);
  }, [loadProjects, runScan]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Narrative OS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Understand how the internet perceives your brand, detect proof gaps, and get a prioritised PR action plan.
          </p>
        </div>
        {(!loading && projects.length > 0) && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4" /> New Analysis
          </Button>
        )}
      </div>

      {/* Project list / onboarding */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <PROnboarding onCreated={handleProjectCreated} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onRunScan={runScan}
              isScanning={scanningId === p.id}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
};

export default PR;
