import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Upload, Plus, Users, Instagram, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface Influencer {
  id: string;
  user_id: string;
  name: string;
  username: string;
  followers: number;
  niche_audience: string | null;
  geography: string | null;
  created_at: string;
}

interface AddForm {
  name: string;
  username: string;
  followers: string;
  niche_audience: string;
  geography: string;
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
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-pink-100 text-pink-700",
  "bg-emerald-100 text-emerald-700",
];

function avatarClass(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Add Influencer Dialog ─────────────────────────────────────────────────────

function AddInfluencerDialog({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<AddForm>({
    name: "",
    username: "",
    followers: "",
    niche_audience: "",
    geography: "United Kingdom",
  });

  const mutation = useMutation({
    mutationFn: async (data: AddForm) => {
      const { error } = await supabase.from("influencers").insert({
        user_id: userId,
        name: data.name.trim(),
        username: data.username.replace(/^@/, "").trim(),
        followers: Number(data.followers) || 0,
        niche_audience: data.niche_audience || null,
        geography: data.geography || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencers"] });
      toast({ title: "Influencer added" });
      setForm({ name: "", username: "", followers: "", niche_audience: "", geography: "United Kingdom" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const set = (k: keyof AddForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add influencer</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="e.g. Sophie Rumble" value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="username">Instagram handle</Label>
            <Input id="username" placeholder="@handle" value={form.username} onChange={(e) => set("username")(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Niche</Label>
              <Select value={form.niche_audience} onValueChange={set("niche_audience")}>
                <SelectTrigger><SelectValue placeholder="Select niche" /></SelectTrigger>
                <SelectContent>
                  {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Geography</Label>
              <Select value={form.geography} onValueChange={set("geography")}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="followers">Followers (optional)</Label>
            <Input id="followers" type="number" placeholder="e.g. 25000" value={form.followers} onChange={(e) => set("followers")(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!form.name || !form.username || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add influencer
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

  const [search, setSearch]       = useState("");
  const [niche, setNiche]         = useState("any");
  const [geography, setGeography] = useState("any");
  const [minF, setMinF]           = useState("");
  const [maxF, setMaxF]           = useState("");
  const [addOpen, setAddOpen]     = useState(false);

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

  return (
    <div className="flex flex-col bg-background" style={{ height: '100dvh' }}>

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
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Filter sidebar ── */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-card p-5 flex flex-col gap-5 overflow-y-auto">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              placeholder="Search by name or @handle"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Niche / Audience */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Niche / Audience</Label>
            <Select value={niche} onValueChange={setNiche}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Geography */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Geography</Label>
            <Select value={geography} onValueChange={setGeography}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Followers */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Followers</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={minF}
                onChange={(e) => setMinF(e.target.value)}
                className="h-9 text-sm"
              />
              <span className="text-muted-foreground text-sm flex-shrink-0">–</span>
              <Input
                type="number"
                placeholder="Max"
                value={maxF}
                onChange={(e) => setMaxF(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Clear */}
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
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
            <h1 className="text-xl font-semibold text-foreground">Influencers</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => toast({ title: "Bulk upload coming soon", description: "Use the CSV form on the website to onboard creators." })}
              >
                <Upload className="w-3.5 h-3.5" />
                Bulk Upload
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add Influencer
              </Button>
            </div>
          </div>

          {/* Table header */}
          <div className="px-6 py-2.5 border-b border-border bg-muted/30 flex items-center flex-shrink-0">
            <span className="text-sm text-muted-foreground flex-1">
              <span className="font-semibold text-foreground">{filtered.length}</span> profiles
            </span>
            <div className="grid gap-0" style={{ gridTemplateColumns: "120px 180px 160px" }}>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-right pr-6">Followers</span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Niche</span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Geography</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {isLoading && (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                <Users className="w-10 h-10 opacity-25" />
                <p className="text-sm">No influencers found. Add your first one!</p>
              </div>
            )}

            {!isLoading && filtered.map((inf, i) => (
              <div
                key={inf.id}
                className={`px-6 py-3 border-b border-border flex items-center hover:bg-muted/20 transition-colors ${
                  i % 2 === 0 ? "bg-card" : "bg-background"
                }`}
              >
                {/* Name + handle */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarClass(inf.name)}`}>
                    {getInitials(inf.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inf.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Instagram className="w-3 h-3 text-pink-400 flex-shrink-0" />
                      @{inf.username}
                    </p>
                  </div>
                </div>

                {/* Right columns */}
                <div className="grid items-center" style={{ gridTemplateColumns: "120px 180px 160px" }}>
                  <span className="text-sm font-medium text-foreground text-right pr-6">
                    {fmtFollowers(inf.followers)}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {inf.niche_audience ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {inf.geography ?? "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <AddInfluencerDialog open={addOpen} onClose={() => setAddOpen(false)} userId={user.id} />
    </div>
  );
}
