import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, FileText, AlertTriangle } from "lucide-react";

interface PageMetric {
  structural_score?: number | null;
  visibility_score?: number | null;
  revenue_score?: number | null;
  page?: { page_type?: string | null } | null;
}

interface ActionRow {
  severity?: string | null;
  title?: string | null;
  action_type?: string | null;
}

interface SiteSummary {
  totalPages: number;
  avgSeoScore: number;
  avgContentScore: number;
  avgTechnicalScore: number;
  opportunityScore: number;
  healthGrade: string;
  criticalCount: number;
  topIssues: { label: string; count: number }[];
  pageTypeDist: Record<string, number>;
}

function safeAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function computeGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

const gradeStyle: Record<string, string> = {
  A: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400",
  B: "from-primary/20 to-primary/5 border-primary/30 text-primary",
  C: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
  D: "from-destructive/20 to-destructive/5 border-destructive/30 text-destructive",
};

function computeSummary(metrics: PageMetric[], actions: ActionRow[]): SiteSummary | null {
  if (metrics.length === 0) return null;

  const seoScores = metrics.map((m) => m.structural_score ?? 0);
  const contentScores = metrics.map((m) => m.visibility_score ?? 0);
  const techScores = metrics.map((m) => m.revenue_score ?? 0);

  const avgSeo = safeAvg(seoScores);
  const avgContent = safeAvg(contentScores);
  const avgTech = safeAvg(techScores);
  const opportunity = Math.round(avgSeo * 0.4 + avgContent * 0.3 + avgTech * 0.3);

  // Page type distribution
  const dist: Record<string, number> = {};
  for (const m of metrics) {
    const type = (m.page?.page_type || "other").toLowerCase();
    dist[type] = (dist[type] || 0) + 1;
  }

  // Critical issues
  const criticalCount = actions.filter(
    (a) => (a.severity || "").toLowerCase() === "high"
  ).length;

  // Top issues by action_type or title
  const issueMap: Record<string, number> = {};
  for (const a of actions) {
    const key = (a as any).action_type || a.title || "Unknown";
    issueMap[key] = (issueMap[key] || 0) + 1;
  }
  const topIssues = Object.entries(issueMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({
      label: label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }));

  return {
    totalPages: metrics.length,
    avgSeoScore: avgSeo,
    avgContentScore: avgContent,
    avgTechnicalScore: avgTech,
    opportunityScore: opportunity,
    healthGrade: computeGrade(opportunity),
    criticalCount,
    topIssues,
    pageTypeDist: dist,
  };
}

export default function SiteHealthDashboard({
  metrics,
  actions,
}: {
  metrics: PageMetric[];
  actions: ActionRow[];
}) {
  const summary = useMemo(() => computeSummary(metrics, actions), [metrics, actions]);

  if (!summary) return null;

  const grade = summary.healthGrade;
  const gs = gradeStyle[grade] || gradeStyle.D;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Site Health Overview</h2>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Health Grade */}
        <Card className={`border bg-gradient-to-br ${gs}`}>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
            <Shield className="w-5 h-5 opacity-70" />
            <span className="text-4xl font-black tracking-tight">{grade}</span>
            <span className="text-xs text-muted-foreground">Site Health</span>
          </CardContent>
        </Card>

        {/* Opportunity Score */}
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-3xl font-bold text-foreground tabular-nums">
              {summary.opportunityScore}
            </span>
            <span className="text-xs text-muted-foreground">Opportunity Score</span>
          </CardContent>
        </Card>

        {/* Total Pages */}
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
            <FileText className="w-5 h-5 text-accent" />
            <span className="text-3xl font-bold text-foreground tabular-nums">
              {summary.totalPages}
            </span>
            <span className="text-xs text-muted-foreground">Pages Crawled</span>
          </CardContent>
        </Card>

        {/* Critical Issues */}
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
            <AlertTriangle className={`w-5 h-5 ${summary.criticalCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <span className="text-3xl font-bold text-foreground tabular-nums">
              {summary.criticalCount}
            </span>
            <span className="text-xs text-muted-foreground">Critical Issues</span>
          </CardContent>
        </Card>
      </div>

      {/* Top Issues row */}
      {summary.topIssues.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Top Issues:</span>
          {summary.topIssues.map((issue, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-xs bg-destructive/10 text-destructive border-destructive/20"
            >
              {issue.label} ({issue.count})
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
