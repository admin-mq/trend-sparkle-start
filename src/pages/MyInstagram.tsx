import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instagram, Link2, Loader2, TrendingUp, Eye, Bookmark, Share2,
  Sparkles, Hash, ArrowRight, ExternalLink, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type SyncedPost = {
  caption: string | null;
  media_type: string | null;
  posted_at: string | null;
  permalink: string | null;
  impressions: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
};

type AISummary = {
  headline: string;
  best_content_type: string;
  top_engagement_driver: string;
  reach_trend: string;
  recommendations: string[];
};

type TrendingPost = {
  id: string;
  caption: string | null;
  media_type: string | null;
  like_count: number | null;
  comments_count: number | null;
  permalink: string | null;
};

type TrendingSection = {
  hashtag: string;
  posts: TrendingPost[];
};

type AnalysisResult = {
  connection: { username: string; profile_picture_url: string | null };
  posts: SyncedPost[];
  summary: AISummary | null;
  trending: TrendingSection[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number | null) =>
  n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const mediaTypeLabel = (t: string | null) => {
  if (!t) return "POST";
  if (t === "IMAGE") return "Photo";
  if (t === "VIDEO") return "Reel";
  if (t === "CAROUSEL_ALBUM") return "Carousel";
  return t;
};

const trendColor = (trend: string) => {
  if (trend.toLowerCase().startsWith("improving")) return "text-emerald-500";
  if (trend.toLowerCase().startsWith("declining"))  return "text-rose-500";
  return "text-amber-500";
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyInstagram() {
  const { user } = useAuthContext();
  const navigate  = useNavigate();

  const [connected,    setConnected]    = useState<boolean | null>(null);
  const [igConnecting, setIgConnecting] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [data,         setData]         = useState<AnalysisResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Check if Instagram is connected
  useEffect(() => {
    if (!user) return;
    supabase
      .from("instagram_connections")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: conn }) => setConnected(!!conn));
  }, [user]);

  // Load analysis once we know they're connected
  useEffect(() => {
    if (!connected || !user) return;
    loadAnalysis();
  }, [connected, user]);

  const loadAnalysis = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("ig-performance-analysis", {
        body: { user_id: user.id },
      });
      if (fnErr || res?.error) throw new Error(res?.error || fnErr?.message);
      setData(res as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Instagram data");
      toast.error("Could not load Instagram data");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstagram = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    setIgConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/instagram-callback`;
      const { data: res, error: fnErr } = await supabase.functions.invoke("instagram-auth", {
        body: { action: "initiate", redirect_uri: redirectUri },
      });
      if (fnErr || res?.error) throw new Error(res?.error || fnErr?.message);
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Instagram connection");
      setIgConnecting(false);
    }
  };

  // ── Not connected ──────────────────────────────────────────────────────────
  if (connected === false) {
    return (
      <div className="p-6 max-w-lg mx-auto flex flex-col items-center gap-6 pt-20">
        <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center">
          <Instagram className="w-8 h-8 text-pink-500" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">My Instagram</h1>
          <p className="text-muted-foreground text-sm">
            Connect your Instagram Business account to see your post performance and what's trending in your niche.
          </p>
        </div>
        <Button
          onClick={handleConnectInstagram}
          disabled={igConnecting}
          className="gap-2 bg-pink-500 hover:bg-pink-600 text-white"
        >
          {igConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {igConnecting ? "Connecting…" : "Connect Instagram"}
        </Button>
      </div>
    );
  }

  // ── Loading check ──────────────────────────────────────────────────────────
  if (connected === null || loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span className="text-sm">{loading ? "Analysing your Instagram…" : "Checking connection…"}</span>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto pt-20 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={loadAnalysis}>Try again</Button>
      </div>
    );
  }

  if (!data) return null;

  const { connection, posts, summary, trending } = data;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        {connection.profile_picture_url ? (
          <img src={connection.profile_picture_url} alt={connection.username} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-pink-500/15 flex items-center justify-center">
            <Instagram className="w-5 h-5 text-pink-500" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">My Instagram</h1>
          <p className="text-sm text-muted-foreground">@{connection.username}</p>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto gap-1 text-xs text-muted-foreground" onClick={loadAnalysis}>
          Refresh
        </Button>
      </div>

      {/* ── AI Performance Summary ── */}
      {summary && (
        <Card className="border-pink-500/20 bg-pink-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500" />
              Performance Summary
            </CardTitle>
            <CardDescription className="text-foreground/80 font-medium">{summary.headline}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Best content type</p>
                <p>{summary.best_content_type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Engagement driver</p>
                <p>{summary.top_engagement_driver}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Reach trend</p>
                <p className={trendColor(summary.reach_trend)}>{summary.reach_trend}</p>
              </div>
            </div>
            {summary.recommendations?.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Recommendations</p>
                <ul className="space-y-1.5">
                  {summary.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <ArrowRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-pink-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Post Performance ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Post Performance
          </CardTitle>
          <CardDescription>Your last {posts.length} posts — impressions, reach, saves, shares</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No posts synced yet. This updates automatically after connecting.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Post</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                      <Eye className="w-3.5 h-3.5 inline mr-1" />Reach
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5 inline mr-1" />Impr.
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                      <Bookmark className="w-3.5 h-3.5 inline mr-1" />Saves
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                      <Share2 className="w-3.5 h-3.5 inline mr-1" />Shares
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                            {mediaTypeLabel(post.media_type)}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate text-foreground/90">
                              {post.caption ? post.caption.slice(0, 80) : <span className="text-muted-foreground italic">No caption</span>}
                            </p>
                            {post.posted_at && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {new Date(post.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmt(post.reach)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(post.impressions)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmt(post.saved)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          {fmt(post.shares)}
                          {post.permalink && (
                            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Trending in Your Niche ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Hash className="w-4 h-4 text-pink-500" />
            Trending in Your Niche
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Top content right now under the hashtags you use most</p>
        </div>

        {trending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {summary === null
                ? "Connect Instagram and save your profile to generate hashtag trends."
                : "No hashtag trend data yet — this populates once your persona has top hashtags identified."}
            </CardContent>
          </Card>
        ) : (
          trending.map(({ hashtag, posts: tPosts }) => (
            <Card key={hashtag}>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-pink-500">#{hashtag}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {tPosts.map((tp) => (
                  <div key={tp.id} className="flex items-start justify-between gap-3 text-sm py-2 border-b border-border/40 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground/90">
                        {tp.caption ? tp.caption.slice(0, 100) : <span className="text-muted-foreground italic">No caption</span>}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {tp.like_count != null && <span>❤️ {fmt(tp.like_count)}</span>}
                        {tp.comments_count != null && <span>💬 {fmt(tp.comments_count)}</span>}
                        {tp.media_type && <Badge variant="outline" className="text-[10px]">{mediaTypeLabel(tp.media_type)}</Badge>}
                      </div>
                    </div>
                    {tp.permalink && (
                      <a href={tp.permalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}
