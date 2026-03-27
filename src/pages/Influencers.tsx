import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search, Users, Instagram, Loader2, Sparkles, RefreshCw, HandshakeIcon,
  CheckCircle2, Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface Influencer {
  id: string;
  user_id: string | null;
  name: string;
  username: string;
  followers: number;
  niche_audience: string | null;
  geography: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  barter_open: boolean | null;
  signup_date: string | null;
  created_at: string;
}

interface ConnectionRequest {
  influencer_id: string;
  status: string;
}

const NICHES = ["Fashion & Clothing", "Health & Fitness"];
const GEOGRAPHIES = ["United Kingdom"];

function fmtFollowers(n: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-300",
  "bg-sky-500/20 text-sky-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-teal-500/20 text-teal-300",
  "bg-indigo-500/20 text-indigo-300",
  "bg-pink-500/20 text-pink-300",
  "bg-emerald-500/20 text-emerald-300",
];

function avatarClass(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Connect Dialog ────────────────────────────────────────────────────────────

function ConnectDialog({
  influencer,
  brandId,
  brandEmail,
  onClose,
  onSuccess,
}: {
  influencer: Influencer;
  brandId: string;
  brandEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleConnect = async () => {
    setSending(true);
    try {
      const { error } = await supabase.from("connection_requests").insert({
        brand_id: brandId,
        brand_email: brandEmail,
        influencer_id: influencer.id,
        message: message.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already requested",
            description: "You've already sent a connection request to this creator.",
          });
        } else {
          throw error;
        }
      } else {
        // Fire notification to admin — non-blocking
        supabase.auth.getSession().then(({ data }) => {
          const token = data.session?.access_token;
          if (token) {
            fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-connection-notification`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  brand_email: brandEmail,
                  influencer_name: influencer.name,
                  influencer_username: influencer.username,
                  niche: influencer.niche_audience,
                  message: message.trim(),
                }),
              }
            ).catch(() => {});
          }
        });

        toast({
          title: "Connection request sent! 🎉",
          description: `We'll reach out to ${influencer.name} and facilitate the collaboration.`,
        });
        onSuccess();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
    setSending(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-primary" />
            Connect with {influencer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Influencer preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              {influencer.avatar_url ? (
                <img
                  src={influencer.avatar_url}
                  alt={influencer.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : null}
              {!influencer.avatar_url && (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${avatarClass(influencer.name)}`}>
                  {getInitials(influencer.name)}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{influencer.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Instagram className="w-3 h-3 text-pink-400" />
                @{influencer.username}
                {influencer.niche_audience && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                    {influencer.niche_audience}
                  </span>
                )}
              </p>
            </div>
            {influencer.barter_open && (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/20">
                Open to Barter
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="collab-msg" className="text-sm">
              Message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="collab-msg"
              placeholder="Tell the creator about your brand and what kind of collaboration you have in mind…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Our team will review your request and connect you with the creator within 1–2 business days.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={sending} className="gap-2">
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <HandshakeIcon className="w-4 h-4" />
            )}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Influencers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch]         = useState("");
  const [niche, setNiche]           = useState("any");
  const [geography, setGeography]   = useState("any");
  const [minF, setMinF]             = useState("");
  const [maxF, setMaxF]             = useState("");
  const [syncing, setSyncing]       = useState(false);
  const [connectTarget, setConnect] = useState<Influencer | null>(null);

  // ── Influencers query ──
  const { data: influencers = [], isLoading } = useQuery<Influencer[]>({
    queryKey: ["influencers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // ── My connection requests ──
  const { data: myConnections = [] } = useQuery<ConnectionRequest[]>({
    queryKey: ["connection_requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connection_requests")
        .select("influencer_id, status")
        .eq("brand_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const connectionMap = useMemo(() => {
    const map: Record<string, string> = {};
    myConnections.forEach((c) => { map[c.influencer_id] = c.status; });
    return map;
  }, [myConnections]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const minFollowers = minF ? Number(minF) : 0;
    const maxFollowers = maxF ? Number(maxF) : Infinity;
    return influencers.filter((inf) => {
      if (q && !inf.name.toLowerCase().includes(q) && !inf.username.toLowerCase().includes(q)) return false;
      if (niche !== "any" && inf.niche_audience !== niche) return false;
      if (geography !== "any" && inf.geography !== geography) return false;
      if (inf.followers < minFollowers || inf.followers > maxFollowers) return false;
      return true;
    });
  }, [influencers, search, niche, geography, minF, maxF]);

  // ── Sync photos ──
  const syncPhotos = async () => {
    if (!user || syncing) return;
    const missing = influencers.filter((inf) => !inf.avatar_url);
    if (!missing.length) {
      toast({ title: "All photos already synced" });
      return;
    }
    setSyncing(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    let synced = 0;
    for (const inf of missing) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-instagram-avatar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ influencer_id: inf.id, username: inf.username }),
          }
        );
        if (res.ok) synced++;
      } catch { /* skip */ }
    }
    setSyncing(false);
    queryClient.invalidateQueries({ queryKey: ["influencers"] });
    toast({
      title: `Synced ${synced} of ${missing.length} photos`,
      description: synced < missing.length ? "Some profiles may be private or unavailable." : undefined,
    });
  };

  const onConnectSuccess = () => {
    setConnect(null);
    queryClient.invalidateQueries({ queryKey: ["connection_requests", user?.id] });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">Please sign in to view influencers.</p>
          <Link to="/" className="text-primary text-sm hover:underline">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  const userEmail = user.email ?? "";

  return (
    <div className="flex flex-col bg-background min-h-screen">

      {/* ── Nav ── */}
      <header className="border-b border-border bg-card px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-sm hidden sm:block">Marketers Quest</span>
        </Link>

        <nav className="flex items-center gap-1 ml-2 text-sm">
          <Link to="/" className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Trends
          </Link>
          <span className="px-3 py-1.5 rounded-md bg-primary/10 text-primary font-medium">
            Influencers
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <Settings className="w-3.5 h-3.5" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1">

        {/* ── Filter sidebar ── */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-card p-5 flex flex-col gap-5">

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              placeholder="Search by name or @handle"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Niche / Audience</Label>
            <Select value={niche} onValueChange={setNiche}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Geography</Label>
            <Select value={geography} onValueChange={setGeography}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Followers</Label>
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Min" value={minF} onChange={(e) => setMinF(e.target.value)} className="h-9 text-sm" />
              <span className="text-muted-foreground text-sm flex-shrink-0">–</span>
              <Input type="number" placeholder="Max" value={maxF} onChange={(e) => setMaxF(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {(search || niche !== "any" || geography !== "any" || minF || maxF) && (
            <button
              onClick={() => { setSearch(""); setNiche("any"); setGeography("any"); setMinF(""); setMaxF(""); }}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md py-1.5 transition-colors"
            >
              Clear filters
            </button>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col">

          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
            <h1 className="text-xl font-semibold text-foreground">Influencers</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={syncing} onClick={syncPhotos}>
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Photos"}
              </Button>
              <Link to="/admin">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Bulk Upload
                </Button>
              </Link>
            </div>
          </div>

          {/* Table header */}
          <div className="px-6 py-2.5 border-b border-border bg-muted/30 flex items-center flex-shrink-0">
            <span className="text-sm text-muted-foreground flex-1">
              <span className="font-semibold text-foreground">{filtered.length}</span> profiles
            </span>
            <div className="grid items-center" style={{ gridTemplateColumns: "100px 160px 130px 120px" }}>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-right pr-6">Followers</span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Niche</span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Geography</span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">Connect</span>
            </div>
          </div>

          {/* Rows */}
          <div>
            {isLoading && (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                <Users className="w-10 h-10 opacity-25" />
                <p className="text-sm">No influencers found.</p>
                <Link to="/admin" className="text-xs text-primary hover:underline">
                  Upload a CSV to import creators →
                </Link>
              </div>
            )}

            {!isLoading && filtered.map((inf, i) => {
              const connStatus = connectionMap[inf.id];
              return (
                <div
                  key={inf.id}
                  className={`px-6 py-3 border-b border-border flex items-center hover:bg-muted/20 transition-colors ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  }`}
                >
                  {/* Avatar + name + handle */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden">
                      {inf.avatar_url ? (
                        <img
                          src={inf.avatar_url}
                          alt={inf.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${avatarClass(inf.name)}`}>
                          {getInitials(inf.name)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{inf.name}</p>
                        {inf.barter_open && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/20 flex-shrink-0">
                            Barter ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Instagram className="w-3 h-3 text-pink-400 flex-shrink-0" />
                        @{inf.username}
                      </p>
                    </div>
                  </div>

                  {/* Right columns */}
                  <div className="grid items-center" style={{ gridTemplateColumns: "100px 160px 130px 120px" }}>
                    <span className="text-sm font-medium text-foreground text-right pr-6">
                      {fmtFollowers(inf.followers)}
                    </span>
                    <span>
                      {inf.niche_audience ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                          {inf.niche_audience}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {inf.geography ?? "—"}
                    </span>
                    <div className="flex justify-center">
                      {connStatus === "accepted" ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Connected
                        </span>
                      ) : connStatus === "pending" ? (
                        <Button variant="outline" size="sm" disabled className="h-7 text-xs gap-1 opacity-60">
                          <CheckCircle2 className="w-3 h-3" />
                          Requested
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setConnect(inf)}
                        >
                          <HandshakeIcon className="w-3 h-3" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Connect dialog */}
      {connectTarget && (
        <ConnectDialog
          influencer={connectTarget}
          brandId={user.id}
          brandEmail={userEmail}
          onClose={() => setConnect(null)}
          onSuccess={onConnectSuccess}
        />
      )}
    </div>
  );
}
