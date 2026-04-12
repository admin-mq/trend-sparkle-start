import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, Loader2, UserPlus, Instagram,
  AlertCircle, CheckCircle2, Sparkles, LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const NICHES = [
  "Fashion & Clothing", "Health & Fitness", "Beauty & Skincare",
  "Food & Nutrition", "Travel & Lifestyle", "Tech & Gaming",
  "Parenting & Family", "Finance & Business", "Home & Interior", "Sports & Fitness",
];

interface IGProfile {
  username: string;
  name: string;
  biography: string;
  avatar_url: string;
}

export default function MasterAdmin() {
  const { user, loading } = useAuth();

  const [username, setUsername] = useState("");
  const [fetching, setFetching] = useState(false);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followers, setFollowers] = useState("");
  const [niche, setNiche] = useState("Fashion & Clothing");
  const [barter, setBarter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <h2 className="text-base font-semibold text-foreground">Sign in required</h2>
          <Link to="/auth" className="block text-xs text-primary hover:underline">Go to sign in →</Link>
        </div>
      </div>
    );
  }

  // ── Handlers ──

  const handleFetch = async () => {
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setFetching(true);
    setProfile(null);
    setError(null);
    setSaved(false);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("lookup-instagram-profile", {
        body: { username: u },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch profile. Make sure the account is public.");
    }
    setFetching(false);
  };

  const handleAdd = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const followerCount = parseInt(followers.replace(/[^0-9]/g, ""), 10) || 0;
      const { data, error: fnErr } = await supabase.functions.invoke("lookup-instagram-profile", {
        body: {
          username: profile.username,
          save: true,
          followers: followerCount,
          niche_audience: niche,
          barter_open: barter,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSaved(true);
      toast.success(`${profile.name} added to the influencer dashboard!`);
      // Reset for next entry
      setUsername("");
      setProfile(null);
      setFollowers("");
      setBarter(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  };

  // ── Main UI ──

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            Marketers Quest
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
              Master Admin
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Dashboard
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground gap-1.5"
          onClick={() => supabase.auth.signOut()}
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </Button>
      </header>

      {/* Content */}
      <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Add Creator by Instagram Username</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter any public Instagram account username — their profile data will be fetched automatically.
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
            <Input
              className="pl-7 h-11 text-base"
              placeholder="instagram_username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setProfile(null); setError(null); setSaved(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              autoFocus
            />
          </div>
          <Button
            size="lg"
            onClick={handleFetch}
            disabled={fetching || !username.trim()}
            className="gap-2 px-5"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {fetching ? "Fetching…" : "Fetch"}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile card */}
        {profile && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Profile header */}
            <div className="p-5 flex items-center gap-4 border-b border-border">
              <Avatar className="h-16 w-16 flex-shrink-0">
                {profile.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {profile.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground text-base">{profile.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Instagram className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                  @{profile.username}
                </p>
              </div>
            </div>

            {/* Bio */}
            {profile.biography && (
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm text-muted-foreground leading-relaxed">{profile.biography}</p>
              </div>
            )}

            {/* Save controls */}
            <div className="px-5 py-4 space-y-4 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Before adding to dashboard</p>
              <div className="grid grid-cols-2 gap-4">
                {/* Followers */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Followers count</label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="e.g. 45000"
                    value={followers}
                    onChange={(e) => setFollowers(e.target.value)}
                  />
                </div>
                {/* Niche */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Niche</label>
                  <Select value={niche} onValueChange={setNiche}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NICHES.map((n) => <SelectItem key={n} value={n} className="text-sm">{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Open to barter?</label>
                <div className="flex gap-2">
                  <Button size="sm" variant={barter ? "default" : "outline"} className="flex-1 h-9 text-sm" onClick={() => setBarter(true)}>Yes</Button>
                  <Button size="sm" variant={!barter ? "default" : "outline"} className="flex-1 h-9 text-sm" onClick={() => setBarter(false)}>No</Button>
                </div>
              </div>

              <Button onClick={handleAdd} disabled={saving} className="w-full gap-2 h-10">
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <UserPlus className="w-4 h-4" />}
                {saving ? "Adding to dashboard…" : "Add to Dashboard"}
              </Button>
            </div>
          </div>
        )}

        {/* Success nudge */}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Added! Type another username above to add more creators.
          </div>
        )}
      </div>
    </div>
  );
}
