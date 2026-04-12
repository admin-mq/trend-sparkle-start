import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Brain, Lock, ArrowLeft, Zap, Instagram,
  Shield, FlaskConical, Clock, Hash, TrendingUp,
  BarChart2, Bookmark, Eye, Share2, Sparkles, RefreshCw,
  Loader2, ChevronRight, Target, Users, Lightbulb,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HashtagItem {
  tag: string;
  score: number;
  role: string;
}

interface OutcomeRow {
  id: string;
  set_chosen: "safe" | "experimental" | null;
  views: number | null;
  saves: number | null;
  shares: number | null;
  follows_gained: number | null;
  posted_at: string | null;
  hashtag_results: Array<{
    hashtags: { safe: HashtagItem[]; experimental: HashtagItem[] };
    set_score: number;
  }>;
  hashtag_requests: Array<{
    region: string;
    goal_type: string;
    created_at: string;
  }>;
}

interface TagPerformance {
  tag: string;
  role: string;
  appearances: number;
  avg_views: number;
  avg_saves: number;
  avg_shares: number;
  performance_score: number; // 0–100, normalised within this dataset
}

interface SetStats {
  count: number;
  avg_views: number;
  avg_saves: number;
  avg_shares: number;
  engagement: number;
}

interface PostingPattern {
  hour: number;
  label: string;
  avg_engagement: number;
  count: number;
}

interface RoleBreakdown {
  role: string;
  count: number;
  avg_score: number;
  color: string;
}

interface Intelligence {
  post_count: number;
  top_tags: TagPerformance[];
  role_breakdown: RoleBreakdown[];
  set_comparison: { safe: SetStats; experimental: SetStats; winner: "safe" | "experimental" | "tied" };
  posting_patterns: PostingPattern[];
  best_hour: number | null;
  insights: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNLOCK_THRESHOLD = 10;

const ROLE_COLORS: Record<string, string> = {
  "Category Anchor": "hsl(217 91% 60%)",
  "Audience Signal":  "hsl(271 81% 60%)",
  "Niche Discovery":  "hsl(142 71% 45%)",
  "Trend Expansion":  "hsl(24 100% 55%)",
  "Geo Relevance":    "hsl(190 95% 50%)",
  "Buyer Intent":     "hsl(330 80% 60%)",
};

const ROLE_STYLES: Record<string, string> = {
  "Category Anchor": "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  "Audience Signal":  "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  "Niche Discovery":  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "Trend Expansion":  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "Geo Relevance":    "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
  "Buyer Intent":     "bg-pink-500/15 text-pink-400 border border-pink-500/30",
};

function hourLabel(h: number): string {
  if (h === 0)  return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const avgArr = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// Engagement score: saves most signal-rich, then shares, then views
const eng = (v: number, s: number, sh: number) =>
  (v ?? 0) * 0.2 + (s ?? 0) * 100 * 0.5 + (sh ?? 0) * 50 * 0.3;

const getResult = (row: OutcomeRow) =>
  Array.isArray(row.hashtag_results) ? row.hashtag_results[0] : (row.hashtag_results as any);

const getRequest = (row: OutcomeRow) =>
  Array.isArray(row.hashtag_requests) ? row.hashtag_requests[0] : (row.hashtag_requests as any);

// ─── Core computation (client-side, no API needed) ────────────────────────────

function computeIntelligence(rows: OutcomeRow[]): Intelligence {
  const avg = avgArr;

  // ── Tag performance map ──────────────────────────────────────────────────
  const tagMap = new Map<string, { role: string; views: number[]; saves: number[]; shares: number[] }>();

  for (const row of rows) {
    const chosen = row.set_chosen as "safe" | "experimental";
    const result = Array.isArray(row.hashtag_results) ? row.hashtag_results[0] : row.hashtag_results;
    const tags: HashtagItem[] = result?.hashtags?.[chosen] ?? [];
    const v  = row.views  ?? 0;
    const s  = row.saves  ?? 0;
    const sh = row.shares ?? 0;

    for (const t of tags) {
      if (!tagMap.has(t.tag)) tagMap.set(t.tag, { role: t.role, views: [], saves: [], shares: [] });
      const entry = tagMap.get(t.tag)!;
      entry.views.push(v);
      entry.saves.push(s);
      entry.shares.push(sh);
    }
  }

  const tagStats: TagPerformance[] = Array.from(tagMap.entries()).map(([tag, d]) => ({
    tag,
    role: d.role,
    appearances: d.views.length,
    avg_views:  Math.round(avg(d.views)),
    avg_saves:  Math.round(avg(d.saves)),
    avg_shares: Math.round(avg(d.shares)),
    performance_score: 0,
  }));

  // Normalise to 0–100
  const rawScores = tagStats.map(t => eng(t.avg_views, t.avg_saves, t.avg_shares));
  const maxRaw    = Math.max(...rawScores, 1);
  tagStats.forEach((t, i) => { t.performance_score = Math.round((rawScores[i] / maxRaw) * 100); });
  tagStats.sort((a, b) => b.performance_score - a.performance_score);

  // ── Role breakdown ───────────────────────────────────────────────────────
  const roleMap = new Map<string, { scores: number[]; count: number }>();
  for (const t of tagStats) {
    if (!roleMap.has(t.role)) roleMap.set(t.role, { scores: [], count: 0 });
    const r = roleMap.get(t.role)!;
    r.scores.push(t.performance_score);
    r.count += t.appearances;
  }
  const role_breakdown: RoleBreakdown[] = Array.from(roleMap.entries()).map(([role, d]) => ({
    role,
    count: d.count,
    avg_score: Math.round(avg(d.scores)),
    color: ROLE_COLORS[role] ?? "hsl(var(--primary))",
  })).sort((a, b) => b.avg_score - a.avg_score);

  // ── Set comparison ───────────────────────────────────────────────────────
  const safeRows = rows.filter(r => r.set_chosen === "safe");
  const expRows  = rows.filter(r => r.set_chosen === "experimental");
  const setStats = (arr: OutcomeRow[]): SetStats => ({
    count:      arr.length,
    avg_views:  Math.round(avg(arr.map(r => r.views  ?? 0))),
    avg_saves:  Math.round(avg(arr.map(r => r.saves  ?? 0))),
    avg_shares: Math.round(avg(arr.map(r => r.shares ?? 0))),
    engagement: avg(arr.map(r => eng(r.views ?? 0, r.saves ?? 0, r.shares ?? 0))),
  });
  const safe = setStats(safeRows);
  const experimental = setStats(expRows);
  const winner: "safe" | "experimental" | "tied" =
    safe.engagement > experimental.engagement * 1.15 ? "safe" :
    experimental.engagement > safe.engagement * 1.15 ? "experimental" : "tied";

  // ── Posting patterns ─────────────────────────────────────────────────────
  const hourMap = new Map<number, number[]>();
  for (const row of rows) {
    if (row.posted_at) {
      const h = new Date(row.posted_at).getHours();
      if (!hourMap.has(h)) hourMap.set(h, []);
      hourMap.get(h)!.push(eng(row.views ?? 0, row.saves ?? 0, row.shares ?? 0));
    }
  }
  const posting_patterns: PostingPattern[] = Array.from(hourMap.entries())
    .map(([hour, scores]) => ({
      hour,
      label: hourLabel(hour),
      avg_engagement: avg(scores),
      count: scores.length,
    }))
    .sort((a, b) => a.hour - b.hour);

  const bestPattern = posting_patterns
    .filter(p => p.count >= 2)
    .reduce<PostingPattern | null>((best, p) =>
      !best || p.avg_engagement > best.avg_engagement ? p : best, null);

  // ── Deterministic insights ───────────────────────────────────────────────
  const insights: string[] = [];
  const topTag    = tagStats[0];
  const bottomTag = tagStats[tagStats.length - 1];
  const topRole   = role_breakdown[0];

  if (topTag && topTag.appearances >= 2) {
    const saveRatio = bottomTag && bottomTag.avg_saves > 0
      ? (topTag.avg_saves / Math.max(bottomTag.avg_saves, 1)).toFixed(1)
      : null;
    insights.push(
      `${topTag.tag} is your strongest tag — averaging ${fmtNum(topTag.avg_saves)} saves and ${fmtNum(topTag.avg_views)} views per post.`
      + (saveRatio && parseFloat(saveRatio) > 2 ? ` It drives ${saveRatio}× more saves than your weakest tag.` : "")
    );
  }

  if (topRole && role_breakdown.length >= 2) {
    insights.push(
      `${topRole.role} tags consistently outperform others in your content. Prioritise this role slot when you're unsure what to include.`
    );
  }

  if (winner !== "tied" && safe.count >= 2 && experimental.count >= 2) {
    const winSet = winner === "safe" ? safe : experimental;
    const loseSet = winner === "safe" ? experimental : safe;
    const uplift = loseSet.engagement > 0
      ? Math.round(((winSet.engagement - loseSet.engagement) / loseSet.engagement) * 100)
      : 0;
    insights.push(
      `Your ${winner === "safe" ? "Safe Reach" : "Experimental"} set is delivering ${uplift > 0 ? `${uplift}% higher` : "stronger"} engagement. Lean into that strategy for your next 5 posts before experimenting again.`
    );
  } else if (winner === "tied" && safe.count >= 2 && experimental.count >= 2) {
    insights.push(
      "Safe and Experimental sets are performing within 15% of each other — you have room to keep testing without sacrificing reach."
    );
  }

  if (bestPattern) {
    const allAvg = avg(posting_patterns.map(p => p.avg_engagement));
    const uplift = allAvg > 0 ? Math.round(((bestPattern.avg_engagement - allAvg) / allAvg) * 100) : 0;
    insights.push(
      `Posts at ${hourLabel(bestPattern.hour)} outperform your average by ${uplift > 0 ? `${uplift}%` : "a noticeable margin"} (${bestPattern.count} post${bestPattern.count > 1 ? "s" : ""} sampled). Consider anchoring your schedule around this window.`
    );
  } else if (posting_patterns.length >= 2) {
    insights.push(
      "Not enough posts per time slot yet for reliable timing data — aim for 2+ posts in the same hour window to unlock pattern detection."
    );
  }

  return {
    post_count: rows.length,
    top_tags: tagStats.slice(0, 10),
    role_breakdown,
    set_comparison: { safe, experimental, winner },
    posting_patterns,
    best_hour: bestPattern?.hour ?? null,
    insights,
  };
}

// ─── Next Actions computation ─────────────────────────────────────────────────

interface NextAction {
  id:      string;
  type:    "strategy" | "tags" | "timing" | "consistency";
  title:   string;
  detail:  string;
  cta?:    string;
  ctaPath?: string;
}

const ACTION_ICON: Record<NextAction["type"], React.ElementType> = {
  strategy:    Shield,
  tags:        Hash,
  timing:      Clock,
  consistency: TrendingUp,
};

const ACTION_COLOR: Record<NextAction["type"], string> = {
  strategy:    "text-primary bg-primary/10",
  tags:        "text-emerald-400 bg-emerald-500/10",
  timing:      "text-amber-400 bg-amber-500/10",
  consistency: "text-orange-400 bg-orange-500/10",
};

function computeNextActions(rows: OutcomeRow[], intel: Intelligence): NextAction[] {
  const actions: Array<NextAction & { priority: number }> = [];
  const { set_comparison, top_tags, role_breakdown, posting_patterns, best_hour } = intel;

  // Sort rows most-recent-first using hashtag_requests.created_at
  const sorted = [...rows].sort((a, b) => {
    const aDate = new Date(getRequest(a)?.created_at ?? 0).getTime();
    const bDate = new Date(getRequest(b)?.created_at ?? 0).getTime();
    return bDate - aDate;
  });
  const recent = sorted.slice(0, 5);

  // ── Rule 1: Strategy drift ───────────────────────────────────────────────
  // Winner set is clear, but recent posts are using the other set
  if (
    set_comparison.winner !== "tied" &&
    set_comparison.safe.count >= 2 &&
    set_comparison.experimental.count >= 2
  ) {
    const winner   = set_comparison.winner;
    const loser    = winner === "safe" ? "experimental" : "safe";
    const recentChoices = recent.map(r => r.set_chosen).filter(Boolean);
    const driftCount    = recentChoices.filter(c => c === loser).length;

    if (driftCount >= 3 && recentChoices.length >= 4) {
      const winEng  = set_comparison[winner].engagement;
      const loseEng = set_comparison[loser].engagement;
      const uplift  = loseEng > 0
        ? Math.round(((winEng - loseEng) / loseEng) * 100)
        : 0;

      actions.push({
        id:       "strategy-drift",
        priority: 1,
        type:     "strategy",
        title:    `Switch back to ${winner === "safe" ? "Safe Reach" : "Experimental"} for your next 3 posts`,
        detail:   `Your ${winner === "safe" ? "Safe Reach" : "Experimental"} set delivers ${
          uplift > 0 ? `${uplift}% more engagement` : "stronger results"
        }, but ${driftCount} of your last ${recentChoices.length} posts used the ${
          loser === "safe" ? "Safe" : "Experimental"
        } set instead.`,
        cta:      "Run New Analysis",
        ctaPath:  "/hashtag-analysis",
      });
    }
  }

  // ── Rule 2: Best role underuse ────────────────────────────────────────────
  if (top_tags.length >= 3 && role_breakdown.length >= 2) {
    const bestRole = role_breakdown[0];
    const postsWithRole = rows.filter(row => {
      const chosen = row.set_chosen as "safe" | "experimental";
      const result = getResult(row);
      const tags: HashtagItem[] = result?.hashtags?.[chosen] ?? [];
      return tags.some(t => t.role === bestRole.role);
    }).length;
    const useRate = Math.round((postsWithRole / rows.length) * 100);

    if (useRate < 60) {
      actions.push({
        id:       "role-underuse",
        priority: 2,
        type:     "tags",
        title:    `Make ${bestRole.role} a non-negotiable in every analysis`,
        detail:   `This is your highest-performing role (avg score ${bestRole.avg_score}) but it only appears in ${useRate}% of your posts. Lock it in as your anchor slot.`,
        cta:      "New Analysis",
        ctaPath:  "/hashtag-analysis",
      });
    }
  }

  // ── Rule 3: Top tag underuse in recent posts ──────────────────────────────
  if (top_tags.length > 0 && top_tags[0].appearances >= 3) {
    const topTag = top_tags[0];
    const recentWithTag = recent.filter(row => {
      const chosen = row.set_chosen as "safe" | "experimental";
      const result = getResult(row);
      const tags: HashtagItem[] = result?.hashtags?.[chosen] ?? [];
      return tags.some(t => t.tag === topTag.tag);
    }).length;

    if (recentWithTag === 0 && recent.length >= 3) {
      actions.push({
        id:       "top-tag-absent",
        priority: 3,
        type:     "tags",
        title:    `Bring ${topTag.tag} back — it's been missing from your last ${recent.length} posts`,
        detail:   `This is your #1 tag${
          topTag.avg_saves > 0 ? ` (avg ${fmtNum(topTag.avg_saves)} saves)` : ""
        }. Use it as a Category Anchor in your next analysis.`,
        cta:      "New Analysis",
        ctaPath:  "/hashtag-analysis",
      });
    }
  }

  // ── Rule 4: Posting time gap ──────────────────────────────────────────────
  if (best_hour !== null && posting_patterns.length >= 3) {
    const bestPattern = posting_patterns.find(p => p.hour === best_hour);
    const recentHours = recent
      .filter(r => r.posted_at)
      .map(r => new Date(r.posted_at!).getHours());

    const nearBest = recentHours.filter(h => Math.abs(h - best_hour) <= 1).length;

    if (nearBest === 0 && recentHours.length >= 3) {
      const allAvg  = avgArr(posting_patterns.map(p => p.avg_engagement));
      const uplift  = allAvg > 0 && bestPattern
        ? Math.round(((bestPattern.avg_engagement - allAvg) / allAvg) * 100)
        : 0;

      actions.push({
        id:       "timing-gap",
        priority: 4,
        type:     "timing",
        title:    `Schedule your next post at ${hourLabel(best_hour)}`,
        detail:   uplift > 0
          ? `Posts in this window average ${uplift}% more engagement than your other times, but none of your last ${recentHours.length} posts landed here.`
          : `This is your highest-engagement window, but none of your recent posts used it.`,
      });
    }
  }

  // ── Rule 5: Declining set quality ────────────────────────────────────────
  const recentScores = recent
    .map(r => getResult(r)?.set_score ?? null)
    .filter((s): s is number => s !== null);

  if (recentScores.length >= 4) {
    const half    = Math.floor(recentScores.length / 2);
    const older   = avgArr(recentScores.slice(half));
    const newer   = avgArr(recentScores.slice(0, half));
    if (older - newer > 8) {
      actions.push({
        id:       "quality-decline",
        priority: 5,
        type:     "consistency",
        title:    "Recent hashtag set quality is slipping — tighten the brief",
        detail:   `Your last ${half} analyses averaged a set score of ${Math.round(newer)}, down from ${Math.round(older)}. Review the Content Positioning card on your next post to realign hook tone with hashtag intent.`,
      });
    }
  }

  const top3 = actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map(({ priority: _p, ...rest }) => rest);

  return top3;
}

// ─── WhatToDoNextCard ─────────────────────────────────────────────────────────

const WhatToDoNextCard = ({
  actions,
  post_count,
  navigate,
}: {
  actions:    NextAction[];
  post_count: number;
  navigate:   ReturnType<typeof useNavigate>;
}) => (
  <div className="post-card overflow-hidden border-primary/20 bg-primary/3 animate-fade-in">
    {/* Header */}
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">What to do next</h2>
      </div>
      <span className="text-xs text-muted-foreground">based on {post_count} posts</span>
    </div>

    {actions.length === 0 ? (
      /* On-track state */
      <div className="px-4 py-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">You're on track — keep the momentum</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            No pattern drift detected. Stick to your current strategy and keep logging results after each post.
          </p>
        </div>
      </div>
    ) : (
      <div className="divide-y divide-border">
        {actions.map((action, i) => {
          const Icon = ACTION_ICON[action.type];
          return (
            <div key={action.id} className="px-4 py-4 flex items-start gap-3">
              {/* Priority number */}
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>

              {/* Icon */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${ACTION_COLOR[action.type]}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground leading-snug">{action.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{action.detail}</p>
                {action.cta && action.ctaPath && (
                  <button
                    onClick={() => navigate(action.ctaPath!)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium mt-1.5 transition-colors"
                  >
                    {action.cta}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ─── Mini bar chart ───────────────────────────────────────────────────────────

const Bar = ({ value, max, color = "hsl(var(--primary))" }: { value: number; max: number; color?: string }) => (
  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-700 ease-out"
      style={{ width: `${Math.round((value / Math.max(max, 1)) * 100)}%`, background: color }}
    />
  </div>
);

// ─── Locked / progress state ─────────────────────────────────────────────────

const LockedState = ({ count, navigate }: { count: number; navigate: ReturnType<typeof useNavigate> }) => {
  const pct = Math.min((count / UNLOCK_THRESHOLD) * 100, 100);
  const remaining = UNLOCK_THRESHOLD - count;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 lg:p-6">
        <div className="max-w-lg mx-auto space-y-6 pt-4">

          {/* Back */}
          <button
            onClick={() => navigate("/hashtag-analysis")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Hashtag Analysis
          </button>

          {/* Hero */}
          <div className="text-center space-y-3 pt-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto relative">
              <Brain className="w-7 h-7 text-primary" />
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
                <Lock className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Creator Intelligence</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Personalised distribution insights built entirely from your own performance data.
              No guesswork — patterns extracted from posts you've actually published.
            </p>
          </div>

          {/* Progress card */}
          <div className="post-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Posts with performance data</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {count} <span className="text-muted-foreground font-normal">/ {UNLOCK_THRESHOLD}</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {remaining > 0
                ? `${remaining} more post${remaining > 1 ? "s" : ""} with results logged to unlock.`
                : "You've hit the threshold — intelligence is ready to generate!"}
            </p>
          </div>

          {/* How to get there faster */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reach 10 faster</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate("/hashtag-analysis")}
                className="w-full post-card p-4 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Log results manually</p>
                  <p className="text-xs text-muted-foreground">After each post, tap "Log Results" in the analysis view</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>

              <button
                onClick={() => navigate("/hashtag-analysis")}
                className="w-full post-card p-4 flex items-center gap-3 hover:border-pink-500/30 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-4 h-4 text-pink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Connect Instagram</p>
                  <p className="text-xs text-muted-foreground">Auto-pulls views, saves &amp; shares from your real posts — no manual entry</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            </div>
          </div>

          {/* Blurred preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
            <div className="space-y-3 select-none pointer-events-none">
              {["Top Performing Hashtags", "Strategy Performance", "Best Posting Windows"].map((title, i) => (
                <div key={i} className="post-card p-4 blur-sm opacity-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded bg-secondary" />
                    <div className="h-3.5 w-40 bg-secondary rounded" />
                  </div>
                  <div className="space-y-2">
                    {[70, 52, 40, 28].map((w, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="h-3 bg-secondary rounded" style={{ width: 90 }} />
                        <div className="flex-1 h-1.5 bg-secondary rounded" />
                        <div className="h-3 w-6 bg-secondary rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const CreatorIntelligence = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [loading,      setLoading]      = useState(true);
  const [outcomeCount, setOutcomeCount] = useState(0);
  const [rawData,      setRawData]      = useState<OutcomeRow[]>([]);
  const [refreshing,   setRefreshing]   = useState(false);

  const loadData = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Count outcomes the user has logged
      const { count } = await supabase
        .from("hashtag_outcomes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("set_chosen", "is", null);

      const total = count ?? 0;
      setOutcomeCount(total);

      if (total >= UNLOCK_THRESHOLD) {
        // Load full data for intelligence computation
        const { data, error } = await supabase
          .from("hashtag_requests")
          .select(`
            id, created_at, region, goal_type,
            hashtag_results ( hashtags, set_score ),
            hashtag_outcomes ( set_chosen, views, saves, shares, follows_gained, posted_at )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        // Keep only rows that have logged outcome data
        const withData = (data ?? []).filter((r: any) => {
          const o = Array.isArray(r.hashtag_outcomes) ? r.hashtag_outcomes[0] : r.hashtag_outcomes;
          return o?.set_chosen != null;
        }) as unknown as OutcomeRow[];

        setRawData(withData);
      }
    } catch (err) {
      console.error("Creator intelligence load error:", err);
      toast.error("Couldn't load intelligence data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const intelligence = useMemo(
    () => (rawData.length >= UNLOCK_THRESHOLD ? computeIntelligence(rawData) : null),
    [rawData]
  );

  const nextActions = useMemo(
    () => (intelligence ? computeNextActions(rawData, intelligence) : []),
    [rawData, intelligence]
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Loading your intelligence data...</span>
        </div>
      </div>
    );
  }

  // ── Locked ───────────────────────────────────────────────────────────────
  if (outcomeCount < UNLOCK_THRESHOLD) {
    return <LockedState count={outcomeCount} navigate={navigate} />;
  }

  // ── Unlocked ─────────────────────────────────────────────────────────────
  if (!intelligence) return null;

  const { top_tags, role_breakdown, set_comparison, posting_patterns, best_hour, insights } = intelligence;
  const maxPatternEng = Math.max(...posting_patterns.map(p => p.avg_engagement), 1);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/hashtag-analysis")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Hashtag Analysis
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Page title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Creator Intelligence</h1>
              <p className="text-xs text-muted-foreground">
                Based on {intelligence.post_count} posts with performance data
              </p>
            </div>
          </div>

          {/* ── What to do next ───────────────────────────────────────────── */}
          <WhatToDoNextCard
            actions={nextActions}
            post_count={intelligence.post_count}
            navigate={navigate}
          />

          {/* ── Key Insights strip ─────────────────────────────────────────── */}
          {insights.length > 0 && (
            <div className="post-card p-4 space-y-3 border-primary/20 bg-primary/3">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Key Insights</p>
              </div>
              <ul className="space-y-2.5">
                {insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-secondary-foreground leading-snug">{ins}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── 3-column stat row ──────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Hash,
                label: "Hashtags tracked",
                value: top_tags.length,
                sub: "with performance data",
              },
              {
                icon: Bookmark,
                label: "Avg saves (top tag)",
                value: top_tags[0] ? fmtNum(top_tags[0].avg_saves) : "—",
                sub: top_tags[0]?.tag ?? "",
              },
              {
                icon: Clock,
                label: "Best posting hour",
                value: best_hour !== null ? hourLabel(best_hour) : "—",
                sub: best_hour !== null ? "local time" : "log more posts",
              },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="post-card p-3.5 space-y-1">
                <Icon className="w-4 h-4 text-muted-foreground mb-2" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Top Performing Hashtags ────────────────────────────────────── */}
          <div className="post-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Top Performing Hashtags</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                ranked by saves · views · shares
              </span>
            </div>
            <div className="divide-y divide-border">
              {top_tags.slice(0, 8).map((t, i) => (
                <div key={t.tag} className="px-4 py-3 flex items-center gap-3">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-foreground">{t.tag}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${
                        ROLE_STYLES[t.role] ?? "bg-secondary text-muted-foreground border border-border"
                      }`}>
                        {t.role}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                        {t.appearances}× used
                      </span>
                    </div>
                    <Bar
                      value={t.performance_score}
                      max={100}
                      color={i === 0 ? "hsl(var(--primary))" : i < 3 ? "hsl(142 71% 45%)" : "hsl(var(--muted-foreground))"}
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
                    {t.avg_saves > 0 && (
                      <span className="flex items-center gap-1">
                        <Bookmark className="w-3 h-3" />
                        {fmtNum(t.avg_saves)}
                      </span>
                    )}
                    {t.avg_views > 0 && (
                      <span className="hidden sm:flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {fmtNum(t.avg_views)}
                      </span>
                    )}
                    <span className="text-sm font-bold text-foreground tabular-nums w-7 text-right">
                      {t.performance_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Safe vs Experimental ──────────────────────────────────────── */}
          <div className="post-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Strategy Performance</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {(["safe", "experimental"] as const).map((type) => {
                const stats = set_comparison[type];
                const isWinner = set_comparison.winner === type;
                const isSafe   = type === "safe";
                return (
                  <div
                    key={type}
                    className={`rounded-xl p-4 space-y-3 border ${
                      isWinner
                        ? isSafe
                          ? "border-primary/40 bg-primary/5"
                          : "border-orange-500/40 bg-orange-500/5"
                        : "border-border bg-secondary/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSafe
                        ? <Shield className={`w-4 h-4 ${isWinner ? "text-primary" : "text-muted-foreground"}`} />
                        : <FlaskConical className={`w-4 h-4 ${isWinner ? "text-orange-400" : "text-muted-foreground"}`} />
                      }
                      <span className={`text-sm font-semibold ${
                        isWinner
                          ? isSafe ? "text-primary" : "text-orange-400"
                          : "text-muted-foreground"
                      }`}>
                        {isSafe ? "Safe Reach" : "Experimental"}
                      </span>
                      {isWinner && (
                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          isSafe ? "bg-primary/15 text-primary" : "bg-orange-500/15 text-orange-400"
                        }`}>
                          Winning
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{stats.count} post{stats.count !== 1 ? "s" : ""}</p>
                    <div className="space-y-1.5">
                      {[
                        { icon: Eye,      label: "Avg views",  val: stats.avg_views  },
                        { icon: Bookmark, label: "Avg saves",  val: stats.avg_saves  },
                        { icon: Share2,   label: "Avg shares", val: stats.avg_shares },
                      ].map(({ icon: Icon, label, val }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{label}</span>
                          <span className="ml-auto font-semibold text-foreground tabular-nums">{fmtNum(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {set_comparison.winner === "tied" && (
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground text-center">
                  Both strategies are within 15% of each other — keep testing to build a clearer signal.
                </p>
              </div>
            )}
          </div>

          {/* ── Posting Time Patterns ─────────────────────────────────────── */}
          {posting_patterns.length >= 3 && (
            <div className="post-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Posting Time Patterns</h2>
                <span className="ml-auto text-xs text-muted-foreground">by engagement score</span>
              </div>
              <div className="p-4">
                {/* Bar chart */}
                <div className="flex items-end gap-1.5 h-24">
                  {posting_patterns.map((p) => {
                    const heightPct = Math.round((p.avg_engagement / maxPatternEng) * 100);
                    const isHot     = p.hour === best_hour;
                    return (
                      <div key={p.hour} className="flex-1 flex flex-col items-center gap-1 group">
                        <div
                          className={`w-full rounded-t transition-all duration-700 ${
                            isHot ? "bg-primary" : "bg-secondary-foreground/20 group-hover:bg-secondary-foreground/30"
                          }`}
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          title={`${p.label}: ${p.count} post${p.count > 1 ? "s" : ""}`}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* Hour labels (show every ~3 hours) */}
                <div className="flex items-center gap-1.5 mt-2">
                  {posting_patterns.map((p) => (
                    <div key={p.hour} className="flex-1 text-center">
                      {p.hour % 3 === 0 ? (
                        <span className={`text-[9px] ${p.hour === best_hour ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                          {p.label}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                {best_hour !== null && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    <span className="text-primary font-medium">{hourLabel(best_hour)}</span> is your highest-engagement posting window
                  </p>
                )}
                {posting_patterns.length < 4 && (
                  <p className="text-xs text-amber-400/80 text-center mt-2">
                    Post at more varied times to build a reliable pattern.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Role Breakdown ────────────────────────────────────────────── */}
          {role_breakdown.length >= 2 && (
            <div className="post-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Strongest Hashtag Roles</h2>
                <span className="ml-auto text-xs text-muted-foreground">avg performance by role</span>
              </div>
              <div className="p-4 space-y-3">
                {role_breakdown.map((r) => (
                  <div key={r.role} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none flex-shrink-0 ${
                        ROLE_STYLES[r.role] ?? "bg-secondary text-muted-foreground border border-border"
                      }`}>
                        {r.role}
                      </span>
                      <span className="ml-auto text-xs font-bold text-foreground tabular-nums">
                        {r.avg_score}
                      </span>
                    </div>
                    <Bar value={r.avg_score} max={100} color={r.color} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground pb-4">
            Intelligence refreshes as you log more results · {intelligence.post_count} posts analysed
          </p>

        </div>
      </div>
    </div>
  );
};

export default CreatorIntelligence;
