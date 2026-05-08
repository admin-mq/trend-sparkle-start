import { useState, useEffect, useCallback } from "react";
import {
  LineChart, TrendingUp, Hash, Bookmark, Eye, Loader2,
  Plus, X, ChevronDown, ChevronUp, Instagram, Sparkles, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistTag {
  tag: string;
  trend_status: "rising" | "plateauing" | "declining" | null;
  trend_score: number | null;
  trend_note: string | null;
}

interface ToneAnalysis {
  primary_tone: string;
  secondary_tone?: string | null;
  writing_style: string;
  content_themes: string[];
  hook_patterns: string[];
  caption_length: string;
  emoji_usage: string;
  cta_style: string;
  hashtag_strategy: string;
  unique_voice: string;
  what_to_borrow: string;
  summary: string;
}

interface ReferenceAccount {
  id: string;
  instagram_handle: string;
  display_name: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  follower_count: number | null;
  why_inspiring: string | null;
  tone_analysis: ToneAnalysis | null;
  last_analyzed_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function TonePill({ label }: { label: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium capitalize">
      {label}
    </span>
  );
}

// ── Reference Account Card ────────────────────────────────────────────────────

function ReferenceAccountCard({
  account,
  onRemove,
  onReanalyze,
}: {
  account: ReferenceAccount;
  onRemove: () => void;
  onReanalyze: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ta = account.tone_analysis;

  return (
    <Card className="border-border">
      <CardContent className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {account.profile_picture_url ? (
              <img src={account.profile_picture_url} alt={account.instagram_handle} className="w-full h-full object-cover" />
            ) : (
              <Instagram className="w-4 h-4 text-primary" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">@{account.instagram_handle}</span>
              {account.display_name && (
                <span className="text-xs text-muted-foreground">· {account.display_name}</span>
              )}
              {account.follower_count && (
                <span className="text-xs text-muted-foreground">
                  · {account.follower_count >= 1000
                    ? `${(account.follower_count / 1000).toFixed(0)}K`
                    : account.follower_count} followers
                </span>
              )}
            </div>
            {account.why_inspiring && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">"{account.why_inspiring}"</p>
            )}
            {ta && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                <TonePill label={ta.primary_tone} />
                {ta.secondary_tone && <TonePill label={ta.secondary_tone} />}
                {ta.content_themes.slice(0, 2).map(t => <TonePill key={t} label={t} />)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={onRemove}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Expanded analysis */}
        {expanded && ta && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{ta.summary}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-medium text-foreground mb-0.5">Writing Style</p>
                <p className="text-muted-foreground">{ta.writing_style}</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">Caption Length</p>
                <p className="text-muted-foreground">{ta.caption_length}</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">Emoji Usage</p>
                <p className="text-muted-foreground capitalize">{ta.emoji_usage}</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">CTA Style</p>
                <p className="text-muted-foreground">{ta.cta_style}</p>
              </div>
            </div>

            {ta.hook_patterns?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Hook Patterns</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {ta.hook_patterns.map(h => <li key={h} className="flex items-start gap-1"><span className="text-primary mt-0.5">·</span>{h}</li>)}
                </ul>
              </div>
            )}

            <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-primary mb-0.5">What to borrow</p>
              <p className="text-xs text-muted-foreground">{ta.what_to_borrow}</p>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={onReanalyze}>
                <Sparkles className="w-3 h-3" /> Re-analyse
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Add Reference Account Form ────────────────────────────────────────────────

function AddReferenceForm({ onAdded }: { onAdded: (account: ReferenceAccount) => void }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [whyInspiring, setWhyInspiring] = useState("");
  const [manualCaptions, setManualCaptions] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!handle.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const captions = manualCaptions
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 10);

      const res = await supabase.functions.invoke("analyze-reference-account", {
        body: {
          instagram_handle: handle.trim(),
          why_inspiring: whyInspiring.trim() || null,
          manual_captions: captions.length > 0 ? captions : undefined,
        },
      });

      if (res.error) throw new Error(res.error.message);

      // Fetch the saved record
      const { data: { user } } = await supabase.auth.getUser();
      const { data: saved } = await (supabase as any)
        .from("creator_reference_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("instagram_handle", handle.replace("@", "").toLowerCase().trim())
        .single();

      if (saved) {
        onAdded(saved);
        toast({ title: "Reference account analysed", description: `@${saved.instagram_handle} style profile is ready.` });
      }

      setHandle("");
      setWhyInspiring("");
      setManualCaptions("");
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed opacity-50 cursor-not-allowed" disabled>
          <Plus className="w-3.5 h-3.5" /> Add Reference Account
        </Button>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
          Coming Soon
        </span>
      </div>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/3">
      <CardContent className="px-4 py-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Add a creator you look up to</p>

        <div>
          <Input
            placeholder="@instagram_handle"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            className="text-sm h-8"
          />
        </div>

        <div>
          <Textarea
            placeholder="Why do you find them inspiring? What do you love about their content? (optional)"
            value={whyInspiring}
            onChange={e => setWhyInspiring(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        <div>
          <Textarea
            placeholder={"Paste 3–5 of their captions here, one per line (optional — helps if Instagram API isn't connected)\n\nExample:\nI went from 0 to 100K followers by doing just one thing every day...\nStop trying to go viral. Do this instead."}
            value={manualCaptions}
            onChange={e => setManualCaptions(e.target.value)}
            rows={4}
            className="text-sm resize-none font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            If you've connected Instagram, captions are fetched automatically.
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={loading || !handle.trim()}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? "Analysing…" : "Analyse Style"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CreatorAnalysis = () => {
  const [watchlist, setWatchlist] = useState<WatchlistTag[]>([]);
  const [hashtagCount, setHashtagCount] = useState(0);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [referenceAccounts, setReferenceAccounts] = useState<ReferenceAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [
      { data: wl },
      { count: hCount },
      { data: hResult },
      { data: refs },
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

      (supabase as any)
        .from("creator_reference_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setWatchlist(wl || []);
    setHashtagCount(hCount || 0);
    const score = hResult?.hashtag_results?.[0]?.set_score ?? hResult?.hashtag_results?.set_score ?? null;
    setLatestScore(score);
    setReferenceAccounts(refs || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRemove = async (id: string) => {
    await (supabase as any).from("creator_reference_accounts").delete().eq("id", id);
    setReferenceAccounts(prev => prev.filter(a => a.id !== id));
    toast({ title: "Removed" });
  };

  const handleReanalyze = async (account: ReferenceAccount) => {
    try {
      const res = await supabase.functions.invoke("analyze-reference-account", {
        body: {
          instagram_handle: account.instagram_handle,
          why_inspiring: account.why_inspiring || null,
          manual_captions: account.recent_captions || undefined,
        },
      });
      if (res.error) throw new Error(res.error.message);
      await load();
      toast({ title: "Re-analysed", description: `@${account.instagram_handle} style profile updated.` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

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
          <p className="text-xs text-muted-foreground">Your content performance and style intelligence</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Hashtag Sets Analysed", value: hashtagCount, icon: Hash },
          { label: "Latest Set Score", value: latestScore !== null ? `${latestScore}/100` : "—", sub: latestScore !== null ? (latestScore >= 70 ? "Strong" : latestScore >= 50 ? "Average" : "Needs work") : "No data yet", icon: TrendingUp },
          { label: "Tags in Watchlist", value: watchlist.length, icon: Bookmark },
          { label: "Rising Tags", value: rising.length, sub: rising.length ? rising.slice(0, 2).map(r => r.tag).join(", ") : "None yet", icon: Eye },
        ].map(({ label, value, sub, icon: Icon }) => (
          <Card key={label}>
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
        ))}
      </div>

      {/* ── Reference Accounts ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Accounts You Look Up To</h2>
            {referenceAccounts.length > 0 && (
              <span className="text-xs text-muted-foreground">({referenceAccounts.length})</span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Add creators whose style you admire. We'll analyse their tone, hooks, and content patterns so Amcue can help you create in a similar direction.
        </p>

        <div className="space-y-2">
          {referenceAccounts.map(account => (
            <ReferenceAccountCard
              key={account.id}
              account={account}
              onRemove={() => handleRemove(account.id)}
              onReanalyze={() => handleReanalyze(account)}
            />
          ))}
        </div>

        <AddReferenceForm onAdded={a => setReferenceAccounts(prev => [a, ...prev])} />
      </div>

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-primary" /> Hashtag Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {watchlist.map(tag => (
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
      )}

      {/* Declining warning */}
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
