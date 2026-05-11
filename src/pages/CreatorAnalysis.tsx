import { useState, useEffect, useCallback } from "react";
import {
  LineChart, TrendingUp, Hash, Loader2,
  Plus, X, ChevronDown, ChevronUp, Instagram, Sparkles, Users,
  AlertCircle, Clock3, Share2, BadgeDollarSign, Globe2,
  BarChart2, ChefHat, Banknote, Bookmark,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Insight cards data ────────────────────────────────────────────────────────

const INSIGHT_CARDS = [
  { title: "Why It Flopped",      description: "See exactly what killed your underperforming post: hook, timing, topic, or the algorithm.", icon: AlertCircle,      accent: "text-rose-500 dark:text-rose-400",    bg: "bg-rose-500/10" },
  { title: "The Swipe Line",      description: "The second viewers tapped away from your Reel. Fix the leak, keep the watch time.",          icon: Clock3,           accent: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/10" },
  { title: "Real Followers",      description: "How many of your followers are actually alive, active, and watching you.",                    icon: Users,            accent: "text-sky-500 dark:text-sky-400",       bg: "bg-sky-500/10" },
  { title: "Who's Sharing You",   description: "The fans quietly DM'ing your content to friends: your real growth engine.",                  icon: Share2,           accent: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/10" },
  { title: "Know Your Worth",     description: "What brands are paying creators just like you. Stop guessing your rate.",                     icon: BadgeDollarSign,  accent: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { title: "Your Other Tribe",    description: "Where else your audience hangs out: Threads, Facebook, WhatsApp.",                           icon: Globe2,           accent: "text-cyan-500 dark:text-cyan-400",     bg: "bg-cyan-500/10" },
  { title: "You vs. Them",        description: "How you stack up against creators your size in your niche. No names, just numbers.",          icon: BarChart2,        accent: "text-amber-500 dark:text-amber-400",   bg: "bg-amber-500/10" },
  { title: "Saves That Pay",      description: "Which saved posts actually turned into clicks, visits, and sales.",                           icon: Bookmark,         accent: "text-primary",                         bg: "bg-primary/10" },
  { title: "Your Content Recipe", description: "The perfect mix of Reels, carousels, and stories: built for your goals.",                    icon: ChefHat,          accent: "text-pink-500 dark:text-pink-400",     bg: "bg-pink-500/10" },
  { title: "Your Money Mirror",   description: "What creators your size are earning. See if you're leaving money on the table.",              icon: Banknote,         accent: "text-teal-500 dark:text-teal-400",     bg: "bg-teal-500/10" },
] as const;

// ── Main Page ─────────────────────────────────────────────────────────────────

const CreatorAnalysis = () => {
  const [hashtagCount, setHashtagCount] = useState(0);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [referenceAccounts, setReferenceAccounts] = useState<ReferenceAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [
      { count: hCount },
      { data: hResult },
      { data: refs },
    ] = await Promise.all([
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
          manual_captions: (account as any).recent_captions || undefined,
        },
      });
      if (res.error) throw new Error(res.error.message);
      await load();
      toast({ title: "Re-analysed", description: `@${account.instagram_handle} style profile updated.` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

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
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Hashtag Sets Analysed", value: hashtagCount, icon: Hash },
          { label: "Latest Set Score", value: latestScore !== null ? `${latestScore}/100` : "—", sub: latestScore !== null ? (latestScore >= 70 ? "Strong" : latestScore >= 50 ? "Average" : "Needs work") : "No data yet", icon: TrendingUp },
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

      {/* ── Analytics Insights ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Analytics Insights</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Deeper intelligence for your content and earnings | COMING SOON.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INSIGHT_CARDS.map((card) => (
            <div key={card.title} className="relative rounded-xl border border-border bg-card p-5 flex flex-col gap-3 overflow-hidden">
              <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                Coming Soon
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <card.icon className={`${card.accent}`} style={{ width: 18, height: 18 }} />
              </div>
              <div className="space-y-1 pr-16">
                <p className="text-sm font-semibold text-foreground leading-snug">{card.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default CreatorAnalysis;
