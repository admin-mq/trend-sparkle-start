import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, BarChart3, AlertTriangle, Target, TrendingUp } from "lucide-react";

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

function formatMoney(min: number, max: number, sym: string): string {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n));
  if (max > min) return `${sym}${fmt(min)} – ${sym}${fmt(max)}`;
  return `${sym}${fmt(min)}`;
}

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
  const money = useMemo((): MoneyData | null => {
    try {
      const str = typeof notes === "string" ? notes : JSON.stringify(notes ?? "{}");
      const parsed = JSON.parse(str);
      const m = parsed?.money;
      console.log("MONEY_EXTRACT:", JSON.stringify(m), "keys_in_notes:", Object.keys(parsed || {}).join(","));
      if (!m || typeof m !== "object") return null;
      return m as MoneyData;
    } catch (e) {
      console.log("MONEY_EXTRACT_ERROR:", e);
      return null;
    }
  }, [notes]);

  console.log("MONEY DEBUG:", JSON.stringify(money), "notes type:", typeof notes, "notes preview:", typeof notes === "string" ? notes.substring(0, 200) : "not string");

  if (!summary) return null;

  const mix = summary.page_type_mix || {};
  const scores = summary.avg_scores || {};
  const issues = Array.isArray(summary.top_issues) ? summary.top_issues : [];
  const areas = Array.isArray(summary.focus_areas) ? summary.focus_areas : [];
  const topPages = Array.isArray(summary.top_opportunity_pages)
    ? summary.top_opportunity_pages.slice(0, 3)
    : [];

  const lossMin = Number(money?.total_monthly_loss_min ?? 0);
  const lossMax = Number(money?.total_monthly_loss_max ?? 0);
  const sym = money?.currency_symbol || "$";

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

      {/* Money Banner */}
      {lossMin > 0 && (
        <div className="space-y-0">
          {money?.safe_browsing_threat && (
            <div className="rounded-t-lg bg-destructive/20 border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              ⚠️ Google has flagged this site as unsafe — all traffic is being blocked
            </div>
          )}
          <Card className={`border-l-4 border-l-destructive border-border bg-card ${money?.safe_browsing_threat ? "rounded-t-none" : ""}`}>
            <CardContent className="p-5 space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estimated Monthly Loss</span>
                <p className="text-2xl font-black text-destructive tabular-nums mt-0.5">
                  {formatMoney(lossMin, lossMax, sym)} <span className="text-base font-medium text-muted-foreground">/ month</span>
                </p>
              </div>
              {money?.executive_summary && (
                <p className="text-sm text-muted-foreground leading-relaxed">{money.executive_summary}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {money?.market && <Badge variant="secondary" className="text-[10px]">Market: {money.market}</Badge>}
                {money?.industry && <Badge variant="secondary" className="text-[10px]">Industry: {money.industry}</Badge>}
                {money?.confidence_score != null && <Badge variant="secondary" className="text-[10px]">Confidence: {money.confidence_score}%</Badge>}
                {Number(money?.estimated_monthly_traffic) > 0 && <Badge variant="secondary" className="text-[10px]">Est. Traffic: {Number(money.estimated_monthly_traffic).toLocaleString()} visits/mo</Badge>}
                {Number(money?.value_per_visitor) > 0 && <Badge variant="secondary" className="text-[10px]">Value/Visitor: {sym}{Number(money.value_per_visitor).toFixed(2)}</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
