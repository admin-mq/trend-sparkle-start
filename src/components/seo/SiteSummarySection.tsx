import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, BarChart3, AlertTriangle, Target, TrendingUp } from "lucide-react";

interface CrawlSummary {
  site_type?: string;
  pages_crawled?: number;
  errors?: number;
  page_type_mix?: Record<string, number>;
  avg_scores?: {
    structural?: number;
    visibility?: number;
    revenue?: number;
    opportunity?: number;
  };
  top_issues?: { label: string; count: number }[];
  focus_areas?: string[];
  top_opportunity_pages?: {
    url?: string;
    page_type?: string;
    opportunity?: number;
    priority_bucket?: string;
  }[];
}

function parseSummary(notes: unknown): CrawlSummary | null {
  if (!notes) return null;
  try {
    const parsed = typeof notes === "string" ? JSON.parse(notes) : notes;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as CrawlSummary;
  } catch {
    return null;
  }
}

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const priorityStyle: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

export default function SiteSummarySection({ notes }: { notes: unknown }) {
  const summary = useMemo(() => parseSummary(notes), [notes]);

  if (!summary) return null;

  const mix = summary.page_type_mix || {};
  const scores = summary.avg_scores || {};
  const issues = Array.isArray(summary.top_issues) ? summary.top_issues : [];
  const areas = Array.isArray(summary.focus_areas) ? summary.focus_areas : [];
  const topPages = Array.isArray(summary.top_opportunity_pages)
    ? summary.top_opportunity_pages.slice(0, 3)
    : [];

  const hasContent =
    summary.site_type ||
    summary.pages_crawled ||
    Object.keys(scores).length > 0 ||
    issues.length > 0 ||
    areas.length > 0 ||
    topPages.length > 0;

  if (!hasContent) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Site Summary</h2>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {/* Card 1 — Crawl Overview */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4 flex-row items-center gap-2">
            <Globe className="w-4 h-4 text-accent shrink-0" />
            <CardTitle className="text-sm font-semibold">Crawl Overview</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-2 text-sm">
            {summary.site_type && (
              <Row label="Site Type" value={summary.site_type} />
            )}
            <Row label="Pages Crawled" value={String(safeNum(summary.pages_crawled))} />
            <Row label="Errors" value={String(safeNum(summary.errors))} />

            {Object.keys(mix).length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Page Type Mix</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(mix).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-[10px] capitalize">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2 — Average Scores */}
        {Object.keys(scores).length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2 pt-4 px-4 flex-row items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent shrink-0" />
              <CardTitle className="text-sm font-semibold">Average Scores</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <ScoreCell label="Structural" value={scores.structural} />
                <ScoreCell label="Visibility" value={scores.visibility} />
                <ScoreCell label="Revenue" value={scores.revenue} />
                <ScoreCell label="Opportunity" value={scores.opportunity} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 3 — Top Issues */}
        {issues.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2 pt-4 px-4 flex-row items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <CardTitle className="text-sm font-semibold">Top Issues</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-1.5">
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5"
                >
                  <span className="text-foreground">{issue.label}</span>
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {issue.count}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Card 4 — Focus Areas */}
        {areas.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2 pt-4 px-4 flex-row items-center gap-2">
              <Target className="w-4 h-4 text-primary shrink-0" />
              <CardTitle className="text-sm font-semibold">Focus Areas</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <ul className="space-y-1.5">
                {areas.map((area, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {area}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Card 5 — Top Opportunity Pages */}
        {topPages.length > 0 && (
          <Card className="border-border md:col-span-2 xl:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4 flex-row items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent shrink-0" />
              <CardTitle className="text-sm font-semibold">Top Opportunity Pages</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {topPages.map((pg, i) => {
                const bucket = (pg.priority_bucket || "medium").toLowerCase();
                return (
                  <div key={i} className="rounded-lg bg-secondary/50 p-2.5 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {pg.page_type || "page"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${priorityStyle[bucket] || ""}`}
                      >
                        {bucket}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                        Score: {safeNum(pg.opportunity)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">{pg.url || "—"}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function ScoreCell({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="text-lg font-bold text-foreground">{safeNum(value)}</p>
    </div>
  );
}
