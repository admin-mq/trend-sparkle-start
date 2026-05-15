import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instagram, Link2, Loader2, TrendingUp, Eye, Bookmark, Share2,
  Sparkles, Hash, ArrowRight, ExternalLink, AlertCircle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Connection = {
  username: string;
  profile_picture_url: string | null;
};

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

type TrendingSection = { hashtag: string; posts: TrendingPost[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number | null) =>
  n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const mediaTypeLabel = (t: string | null) => {
  if (!t) return "POST";
  if (t === "IMAGE")          return "Photo";
  if (t === "VIDEO")          return "Reel";
  if (t === "CAROUSEL_ALBUM") return "Carousel";
  return t;
};

const trendColor = (trend: string) => {
  const l = trend.toLowerCase();
  if (l.startsWith("improving")) return "text-emerald-500";
  if (l.startsWith("declining"))  return "text-rose-500";
  return "text-amber-500";
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyInstagram() {
  const { user } = useAuthContext();

  // ── Connection + posts (direct DB — always available) ─────────────────────
  const [connLoading,  setConnLoading]  = useState(true);
  const [connection,   setConnection]   = useState<Connection | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [posts,        setPosts]        = useState<SyncedPost[]>([]);

  // ── AI analysis + trending (edge function — optional) ─────────────────────
  const [aiLoading,  setAiLoading]  = useState(false);
  const [summary,    setSummary]    = useState<AISummary | null>(null);
  const [trending,   setTrending]   = useState<TrendingSection[]>([]);
  const [aiError,    setAiError]    = useState(false);

  // ── Instagram OAuth ────────────────────────────────────────────────────────
  const [igConnecting, setIgConnecting] = useState(false);

  // Step 1 — check connection directly from DB
  useEffect(() => {
    if (!user) return;
    supabase
      .from("instagram_connections")
      .select("username, profile_picture_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setConnection(data ?? null);
        setConnLoading(false);
      });
  }, [user]);

  // Step 2 — load posts from DB (no edge function needed)
  useEffect(() => {
    if (!connection || !user) return;
    setPostsLoading(true);
    supabase
      .from("instagram_synced_posts")
      .select("caption, media_type, posted_at, permalink, impressions, reach, saved, shares")
      .eq("user_id", user.id)
      .order("posted_at", { ascending: false })
      .limit(25)
      .then(({ data }) => {
        setPosts(data ?? []);
        setPostsLoading(false);
      });
  }, [connection, user]);

  // Step 3 — load AI summary + trending via edge function (optional)
  useEffect(() => {
    if (!connection || !user) return;
    loadAiAnalysis();
  }, [connection, user]);

  const loadAiAnalysis = async () => {
    if (!user) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const { data, error } = await supabase.functions.invoke("ig-performance-analysis", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.summary)  setSummary(data.summary);
      if (data?.trending) setTrending(data.trending);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleConnectInstagram = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    setIgConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/instagram-callback`;
      const { data, error } = await supabase.functions.invoke("instagram-auth", {
        body: { action: "initiate", redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Instagram connection");
      setIgConnecting(false);
    }
  };

  // ── Loading: checking connection ───────────────────────────────────────────
  if (connLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connection) {
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
          {igConnecting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Link2 className="w-4 h-4" />}
          {igConnecting ? "Connecting…" : "Connect Instagram"}
        </Button>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        {connection.profile_picture_url ? (
          <img
            src={connection.profile_picture_url}
            alt={connection.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-pink-500/15 flex items-center justify-center">
            <Instagram className="w-5 h-5 text-pink-500" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">My Instagram</h1>
          <p className="text-sm text-muted-foreground">@{connection.username}</p>
        </div>
        <Button
          variant="ghost" size="sm"
          className="ml-auto gap-1.5 text-xs text-muted-foreground"
          onClick={loadAiAnalysis}
          disabled={aiLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* AI Performance Summary */}
      {aiLoading ? (
        <Card className="border-pink-500/20 bg-pink-500/5 animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="h-3 w-64 bg-muted rounded mt-1" />
          </CardHeader>
          <CardContent className="h-16" />
        </Card>
      ) : summary ? (
        <Card className="border-pink-500/20 bg-pink-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500" />
              Performance Summary
            </CardTitle>
            <CardDescription className="text-foreground/80 font-medium">
              {summary.headline}
            </CardDescription>
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
      ) : aiError ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-4 flex items-center gap-3 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            AI analysis is temporarily unavailable. Your post data below is live.
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={loadAiAnalysis}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Post Performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Post Performance
          </CardTitle>
          <CardDescription>
            Your last {posts.length > 0 ? posts.length : "—"} posts — impressions, reach, saves, shares
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {postsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">
              No posts synced yet. Posts sync automatically after connecting — try refreshing in a moment.
            </p>
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
                              {post.caption
                                ? post.caption.slice(0, 80)
                                : <span className="text-muted-foreground italic">No caption</span>}
                            </p>
                            {post.posted_at && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {new Date(post.posted_at).toLocaleDateString("en-GB", {
                                  day: "numeric", month: "short", year: "numeric",
                                })}
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
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
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

      {/* Trending in Your Niche */}
      {(aiLoading || trending.length > 0) && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Hash className="w-4 h-4 text-pink-500" />
              Trending in Your Niche
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Top content right now under the hashtags you use most
            </p>
          </div>

          {aiLoading ? (
            <Card className="animate-pulse">
              <CardContent className="py-8" />
            </Card>
          ) : (
            trending.map(({ hashtag, posts: tPosts }) => (
              <Card key={hashtag}>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold text-pink-500">#{hashtag}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  {tPosts.map((tp) => (
                    <div
                      key={tp.id}
                      className="flex items-start justify-between gap-3 text-sm py-2 border-b border-border/40 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground/90">
                          {tp.caption
                            ? tp.caption.slice(0, 100)
                            : <span className="text-muted-foreground italic">No caption</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {tp.like_count != null     && <span>❤️ {fmt(tp.like_count)}</span>}
                          {tp.comments_count != null && <span>💬 {fmt(tp.comments_count)}</span>}
                          {tp.media_type && (
                            <Badge variant="outline" className="text-[10px]">
                              {mediaTypeLabel(tp.media_type)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {tp.permalink && (
                        <a
                          href={tp.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                        >
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
      )}

    </div>
  );
}
