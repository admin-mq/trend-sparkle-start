import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle2, Circle, CircleDashed, X, Loader2, Sparkles, ChevronRight,
  Megaphone, Filter, RefreshCw, ListChecks, Building2, AlertCircle,
  DollarSign, Target, Calendar, MapPin, Lightbulb, TrendingUp, Shield,
  ExternalLink, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionStatus = "todo" | "in_progress" | "done" | "dismissed" | "archived";

interface PrAction {
  id: string;
  project_id: string;
  scan_job_id: string | null;
  title: string;
  action_type: string | null;
  effort: string | null;
  priority: number | null;
  expected_impact: string | null;
  what_to_do: string | null;
  why_it_matters: string | null;
  status: ActionStatus;
  status_updated_at: string;
  notes: string | null;
  playbook: Playbook | null;
  playbook_generated_at: string | null;
  created_at: string;
  // joined
  pr_projects?: { id: string; brand_name: string; domain: string } | null;
}

interface Playbook {
  what: string;
  how: string[];
  when: string;
  where: string[];
  why: string;
  success_metrics: string[];
  risks: Array<{ risk: string; mitigation: string }>;
  budget_estimate: {
    range_usd: string;
    confidence: "high" | "medium";
    rationale: string;
    line_items: Array<{ item: string; cost_usd: string }>;
  } | null;
  generated_at: string;
  source: string;
}

interface ProjectOption {
  id: string;
  brand_name: string;
  domain: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ActionStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  dismissed: "Dismissed",
  archived: "Archived",
};

const STATUS_COLOR: Record<ActionStatus, string> = {
  todo: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  done: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  dismissed: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted/40 text-muted-foreground/60 border-border",
};

const IMPACT_COLOR: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABEL: Record<string, string> = {
  pr: "PR",
  narrative: "Narrative",
  authority: "Authority",
  proof: "Proof",
  content: "Content",
  page: "Page",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PRTodo() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [actions, setActions] = useState<PrAction[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectFilter = searchParams.get("project") || "all";
  const statusFilter = (searchParams.get("status") || "todo") as ActionStatus | "all";

  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch the user's PR projects (for filter dropdown)
      const { data: projRows, error: projErr } = await supabase
        .from("pr_projects")
        .select("id, brand_name, domain")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (projErr) throw projErr;
      setProjects(projRows ?? []);

      // Build action query with filters
      let q = supabase
        .from("pr_actions")
        .select(`
          id, project_id, scan_job_id, title, action_type, effort, priority,
          expected_impact, what_to_do, why_it_matters, status, status_updated_at,
          notes, playbook, playbook_generated_at, created_at,
          pr_projects!inner ( id, brand_name, domain )
        `)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);

      const { data: actRows, error: actErr } = await q;
      if (actErr) throw actErr;

      setActions((actRows as any[] ?? []) as PrAction[]);
    } catch (e: any) {
      console.error("[pr-todo] load error:", e);
      setError(e?.message || "Failed to load actions");
    } finally {
      setLoading(false);
    }
  }, [navigate, projectFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Filter setters write to URL ──
  const setProjectFilter = (val: string) => {
    const sp = new URLSearchParams(searchParams);
    if (val === "all") sp.delete("project"); else sp.set("project", val);
    setSearchParams(sp, { replace: true });
  };
  const setStatusFilter = (val: string) => {
    const sp = new URLSearchParams(searchParams);
    if (val === "todo") sp.delete("status"); else sp.set("status", val);
    setSearchParams(sp, { replace: true });
  };

  // ── Group by project for display ──
  const grouped = useMemo(() => {
    const map = new Map<string, { project: ProjectOption; items: PrAction[] }>();
    for (const a of actions) {
      const proj = a.pr_projects;
      if (!proj) continue;
      const cur = map.get(proj.id) ?? { project: proj, items: [] };
      cur.items.push(a);
      map.set(proj.id, cur);
    }
    return Array.from(map.values());
  }, [actions]);

  const counts = useMemo(() => {
    const c = { todo: 0, in_progress: 0, done: 0, dismissed: 0, archived: 0 };
    for (const a of actions) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [actions]);

  // ── Status mutations ──
  const updateStatus = async (id: string, status: ActionStatus) => {
    const prev = actions.find((a) => a.id === id);
    if (!prev) return;
    // Optimistic update
    setActions((rows) => rows.map((a) => (a.id === id ? { ...a, status } : a)));
    const { error: updateErr } = await supabase
      .from("pr_actions")
      .update({ status })
      .eq("id", id);
    if (updateErr) {
      toast({ title: "Failed to update", description: updateErr.message, variant: "destructive" });
      // Roll back
      setActions((rows) => rows.map((a) => (a.id === id ? { ...a, status: prev.status } : a)));
    } else {
      toast({ title: `Marked as ${STATUS_LABEL[status]}` });
      // If filter no longer matches, drop the row
      if (statusFilter !== "all" && status !== statusFilter) {
        setActions((rows) => rows.filter((a) => a.id !== id));
      }
    }
  };

  // ── Open playbook drawer + lazy-generate ──
  const openPlaybook = async (action: PrAction, force = false) => {
    setOpenActionId(action.id);
    if (!force && action.playbook) return; // already loaded

    setPlaybookLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      const SUPABASE_URL = (supabase as any).supabaseUrl
        ?? import.meta.env.VITE_SUPABASE_URL
        ?? "https://njnnpdrevbkhbhzwccuz.supabase.co";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/expand-pr-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ action_id: action.id, force }),
      });
      const json = await res.json();
      if (!res.ok || !json?.playbook) throw new Error(json?.error || `HTTP ${res.status}`);
      setActions((rows) => rows.map((a) => (a.id === action.id ? { ...a, playbook: json.playbook, playbook_generated_at: new Date().toISOString() } : a)));
    } catch (e: any) {
      console.error("[pr-todo] playbook load error:", e);
      toast({ title: "Could not generate playbook", description: e?.message || "Try again in a moment", variant: "destructive" });
    } finally {
      setPlaybookLoading(false);
    }
  };

  const openAction = openActionId ? actions.find((a) => a.id === openActionId) ?? null : null;

  // ── Render ──
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <ListChecks className="w-6 h-6 text-primary" />
                PR To-Do
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Every recommended action across your PR campaigns. Click an action to see the full playbook — what, how, when, where, why, success metrics, risks.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => navigate("/pr")}>
                <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                PR Campaigns
              </Button>
            </div>
          </div>

          {/* Status counts */}
          <div className="mt-5 flex items-center gap-2 flex-wrap text-xs">
            <CountChip label="To Do"        n={counts.todo}        active={statusFilter === "todo"} onClick={() => setStatusFilter("todo")} />
            <CountChip label="In Progress"  n={counts.in_progress} active={statusFilter === "in_progress"} onClick={() => setStatusFilter("in_progress")} />
            <CountChip label="Done"         n={counts.done}        active={statusFilter === "done"} onClick={() => setStatusFilter("done")} />
            <CountChip label="Dismissed"    n={counts.dismissed}   active={statusFilter === "dismissed"} onClick={() => setStatusFilter("dismissed")} />
            <CountChip label="All"          n={null}               active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
          </div>

          {/* Project filter */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Project:</span>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-8 text-xs w-[260px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.brand_name} <span className="text-muted-foreground">({p.domain})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Failed to load</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : actions.length === 0 ? (
          <EmptyState statusFilter={statusFilter} projectFilter={projectFilter} onCta={() => navigate("/pr")} />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ project, items }) => (
              <div key={project.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{project.brand_name}</h2>
                  <span className="text-xs text-muted-foreground">{project.domain}</span>
                  <Badge variant="outline" className="text-[10px] ml-1">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <ActionCard
                      key={a.id}
                      action={a}
                      onOpen={() => openPlaybook(a)}
                      onStatus={(s) => updateStatus(a.id, s)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Playbook drawer */}
      <Sheet open={!!openActionId} onOpenChange={(o) => !o && setOpenActionId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openAction && (
            <PlaybookDrawer
              action={openAction}
              loading={playbookLoading}
              onRegenerate={() => openPlaybook(openAction, true)}
              onStatus={(s) => updateStatus(openAction.id, s)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CountChip({ label, n, active, onClick }: { label: string; n: number | null; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full border text-xs transition-all flex items-center gap-1.5",
        active
          ? "bg-primary text-white border-primary"
          : "bg-card text-foreground border-border hover:border-primary/40"
      )}
    >
      <span>{label}</span>
      {n !== null && (
        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-semibold", active ? "bg-white/20" : "bg-muted")}>{n}</span>
      )}
    </button>
  );
}

function ActionCard({
  action,
  onOpen,
  onStatus,
}: {
  action: PrAction;
  onOpen: () => void;
  onStatus: (s: ActionStatus) => void;
}) {
  const Icon = action.status === "done" ? CheckCircle2
    : action.status === "in_progress" ? CircleDashed
    : action.status === "dismissed" ? X
    : Circle;

  return (
    <Card className="hover:border-primary/40 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Status check */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next: ActionStatus = action.status === "done" ? "todo" : "done";
              onStatus(next);
            }}
            className={cn(
              "mt-0.5 transition-colors",
              action.status === "done" ? "text-emerald-500" : "text-muted-foreground hover:text-primary"
            )}
            title={action.status === "done" ? "Mark as to do" : "Mark as done"}
          >
            <Icon className="w-5 h-5" />
          </button>

          {/* Body — clickable to open playbook */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
            <div className="flex items-start justify-between gap-2">
              <h3 className={cn(
                "text-sm font-medium leading-snug",
                action.status === "done" && "line-through text-muted-foreground",
                action.status === "dismissed" && "text-muted-foreground"
              )}>
                {action.title}
              </h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            </div>

            {action.why_it_matters && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{action.why_it_matters}</p>
            )}

            {/* Meta chips */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {action.priority !== null && (
                <Badge variant="outline" className="text-[10px] gap-0.5">
                  <Zap className="w-2.5 h-2.5" />
                  P{action.priority}
                </Badge>
              )}
              {action.action_type && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {TYPE_LABEL[action.action_type] ?? action.action_type}
                </Badge>
              )}
              {action.effort && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {action.effort} effort
                </Badge>
              )}
              {action.expected_impact && (
                <Badge variant="outline" className={cn("text-[10px] capitalize", IMPACT_COLOR[action.expected_impact])}>
                  {action.expected_impact} impact
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[10px]", STATUS_COLOR[action.status])}>
                {STATUS_LABEL[action.status]}
              </Badge>
              {action.playbook && (
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  Playbook ready
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
          {action.status !== "in_progress" && action.status !== "done" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onStatus("in_progress")}>
              <CircleDashed className="w-3 h-3 mr-1" />
              Start
            </Button>
          )}
          {action.status !== "done" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onStatus("done")}>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Mark Done
            </Button>
          )}
          {action.status !== "dismissed" && action.status !== "done" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onStatus("dismissed")}>
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={onOpen}>
            <Sparkles className="w-3 h-3 mr-1" />
            View Playbook
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaybookDrawer({
  action,
  loading,
  onRegenerate,
  onStatus,
}: {
  action: PrAction;
  loading: boolean;
  onRegenerate: () => void;
  onStatus: (s: ActionStatus) => void;
}) {
  const pb = action.playbook;

  return (
    <>
      <SheetHeader>
        <div className="flex items-start gap-2 flex-wrap">
          {action.priority !== null && (
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <Zap className="w-2.5 h-2.5" /> P{action.priority}
            </Badge>
          )}
          {action.action_type && (
            <Badge variant="outline" className="text-[10px] capitalize">{TYPE_LABEL[action.action_type] ?? action.action_type}</Badge>
          )}
          {action.expected_impact && (
            <Badge variant="outline" className={cn("text-[10px] capitalize", IMPACT_COLOR[action.expected_impact])}>{action.expected_impact} impact</Badge>
          )}
        </div>
        <SheetTitle className="text-lg leading-tight pr-6">{action.title}</SheetTitle>
        {action.pr_projects && (
          <SheetDescription>
            For <span className="font-medium text-foreground">{action.pr_projects.brand_name}</span> · {action.pr_projects.domain}
          </SheetDescription>
        )}
      </SheetHeader>

      {/* Quick action bar */}
      <div className="flex items-center gap-1.5 mt-4 mb-5 flex-wrap">
        {action.status !== "in_progress" && action.status !== "done" && (
          <Button size="sm" variant="outline" onClick={() => onStatus("in_progress")}>
            <CircleDashed className="w-3.5 h-3.5 mr-1.5" /> Start
          </Button>
        )}
        {action.status !== "done" && (
          <Button size="sm" onClick={() => onStatus("done")}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Done
          </Button>
        )}
        {action.status !== "dismissed" && action.status !== "done" && (
          <Button size="sm" variant="ghost" onClick={() => onStatus("dismissed")}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Dismiss
          </Button>
        )}
        <div className="flex-1" />
        {pb && (
          <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
            Regenerate
          </Button>
        )}
      </div>

      {/* Body */}
      {loading && !pb ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating playbook with live web intelligence (Marketers Quest)...
          </p>
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !pb ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Sparkles className="w-8 h-8 text-primary/60 mx-auto mb-2" />
            <p className="text-sm font-medium">Playbook not yet generated</p>
            <p className="text-xs text-muted-foreground mt-1">Click below to generate a deep playbook with live web intelligence.</p>
            <Button size="sm" className="mt-3" onClick={onRegenerate}>Generate Playbook</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* What */}
          <Section icon={Target} title="What" body={pb.what} />

          {/* Why */}
          <Section icon={Lightbulb} title="Why this matters" body={pb.why} />

          {/* When */}
          <Section icon={Calendar} title="When" body={pb.when} />

          {/* Where */}
          {pb.where && pb.where.length > 0 && (
            <SectionList icon={MapPin} title="Where (named channels)" items={pb.where} />
          )}

          {/* How */}
          {pb.how && pb.how.length > 0 && (
            <SectionList icon={ListChecks} title="How (step-by-step)" items={pb.how} numbered />
          )}

          {/* Success metrics */}
          {pb.success_metrics && pb.success_metrics.length > 0 && (
            <SectionList icon={TrendingUp} title="Success metrics" items={pb.success_metrics} />
          )}

          {/* Risks */}
          {pb.risks && pb.risks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Shield className="w-4 h-4 text-amber-500" /> Risks &amp; mitigations
              </h3>
              <div className="space-y-2">
                {pb.risks.map((r, i) => (
                  <Card key={i} className="border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-foreground"><span className="text-amber-500">Risk:</span> {r.risk}</p>
                      <p className="text-xs text-muted-foreground mt-1.5"><span className="font-medium text-emerald-500">Mitigation:</span> {r.mitigation}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Budget — only if present */}
          {pb.budget_estimate && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" /> Budget estimate
                <Badge variant="outline" className="ml-1 text-[10px] capitalize">{pb.budget_estimate.confidence} confidence</Badge>
              </h3>
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-3">
                  <p className="text-base font-semibold text-foreground">{pb.budget_estimate.range_usd}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pb.budget_estimate.rationale}</p>
                  {pb.budget_estimate.line_items && pb.budget_estimate.line_items.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-emerald-500/20 pt-2">
                      {pb.budget_estimate.line_items.map((li, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-xs">
                          <span className="text-foreground">{li.item}</span>
                          <span className="text-muted-foreground font-mono">{li.cost_usd}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Footer */}
          <div className="text-[10px] text-muted-foreground pt-3 border-t border-border flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            Generated {pb.generated_at ? new Date(pb.generated_at).toLocaleString() : "—"} via {pb.source}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h3>
      <p className="text-sm text-foreground/90 leading-relaxed">{body}</p>
    </div>
  );
}

function SectionList({ icon: Icon, title, items, numbered = false }: { icon: React.ElementType; title: string; items: string[]; numbered?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-foreground/90 leading-relaxed flex gap-2">
            <span className={cn("flex-shrink-0", numbered ? "text-primary font-semibold w-5" : "text-muted-foreground")}>
              {numbered ? `${i + 1}.` : "•"}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ statusFilter, projectFilter, onCta }: { statusFilter: string; projectFilter: string; onCta: () => void }) {
  const isFiltered = projectFilter !== "all" || statusFilter !== "todo";
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 text-center">
        <ListChecks className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-base font-medium">
          {isFiltered ? "No actions match these filters" : "No actions yet"}
        </p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
          {isFiltered
            ? "Try clearing the filters or running a fresh PR scan to generate new recommended actions."
            : "Run a PR scan on one of your projects — every recommended action will appear here as a clickable to-do with a deep playbook."}
        </p>
        <Button className="mt-4" onClick={onCta}>
          <Megaphone className="w-3.5 h-3.5 mr-1.5" /> Go to PR Campaigns
        </Button>
      </CardContent>
    </Card>
  );
}
