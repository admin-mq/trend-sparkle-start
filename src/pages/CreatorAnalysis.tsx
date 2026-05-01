import { useState, useEffect, useCallback } from "react";
import { LineChart, TrendingUp, Hash, Bookmark, Eye, Heart, MessageCircle, Share2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Watchlist summary ─────────────────────────────────────────────────────────

interface WatchlistTag {
  tag: string;
  trend_status: "rising" | "plateauing" | "declining" | null;
  trend_score: number | null;
  trend_note: string | null;
}

function TrendBadge({ status }: { status: WatchlistTag["trend_status"] }) {
  if (!status) return null;
  const map: Record<string, string> = {
    rising: "bg-green-500/15 text-green-600 border-green-500/25",
    plateauing: "bg-yellow-500/15 text-yellow-600 border-yellow-500/25",
    declining: "bg-red-500/15 text-red-500 border-red-500/25",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CreatorAnalysis = () => {
  const [watchlist, setWatchlist] = useState<WatchlistTag[]>([]);
  const [hashtagCount, setHashtagCount] = useState<number>(0);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [
      { data: wl },
      { count: hCount },
      { data: hResult },
    ] = await Promise.all([
      (supabase as any)
        .from("hashtag_watchlist")
        .select("tag, trend_status, trend_score, trend_note")
        .eq("user_id", user.id)
        .order("trend_score", { ascending: false })
        .limit(10),

      (supabase as any)
        .from("hashtag_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),

      (supabase as any)
        .from("hashtag_requests")
        .select("hashtag_results(set_score)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setWatchlist(wl || []);
    setHashtagCount(hCount || 0);

    const score = hResult?.hashtag_results?.[0]?.set_score ?? hResult?.hashtag_results?.set_score ?? null;
    setLatestScore(score);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rising = watchlist.filter(w => w.trend_status === "rising");
  const declining = watchlist.filter(w => w.trend_status === "declining");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <LineChart className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">Analysis</h1>
          <p className="text-xs text-muted-foreground">Your content and hashtag performance at a glance</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Hashtag Sets Analysed" value={hashtagCount} icon={Hash} />
        <StatCard
          label="Latest Set Score"
          value={latestScore !== null ? `${latestScore}/100` : "—"}
          sub={latestScore !== null ? (latestScore >= 70 ? "Strong" : latestScore >= 50 ? "Average" : "Needs work") : "No data yet"}
          icon={TrendingUp}
        />
        <StatCard label="Tags in Watchlist" value={watchlist.length} icon={Bookmark} />
        <StatCard
          label="Rising Tags"
          value={rising.length}
          sub={rising.length ? rising.slice(0, 2).map(r => r.tag).join(", ") : "None yet"}
          icon={Eye}
        />
      </div>

      {/* Watchlist breakdown */}
      {watchlist.length > 0 ? (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-primary" /> Hashtag Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {watchlist.map((tag) => (
                <div key={tag.tag} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{tag.tag}</span>
                    {tag.trend_note && (
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">{tag.trend_note}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tag.trend_score !== null && (
                      <span className="text-xs font-medium text-muted-foreground">{tag.trend_score}</span>
                    )}
                    <TrendBadge status={tag.trend_status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <Bookmark className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tags in your watchlist yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add hashtags from Hashtag Analysis to start tracking trends.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Declining tags warning */}
      {declining.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="px-4 py-3 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-red-500 mt-0.5 shrink-0 rotate-180" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {declining.length} tag{declining.length > 1 ? "s are" : " is"} declining
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {declining.map(d => d.tag).join(", ")} — consider replacing these with rising alternatives.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default CreatorAnalysis;
