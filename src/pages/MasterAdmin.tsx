import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import {
  Upload, Loader2, CheckCircle2, XCircle, Clock,
  Instagram, FileText, AlertCircle, RefreshCw,
  Search, UserPlus, ShieldCheck, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ── Only these emails can access this page ────────────────────────────────────
const MASTER_ADMIN_EMAILS = ["admin@marketers.quest"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface IGProfile {
  username: string;
  name: string;
  biography: string;
  followers_count: number;
  media_count: number;
  profile_picture_url: string;
  website?: string;
}

interface ParsedInfluencer {
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  niche_audience: string | null;
  geography: string;
  barter_open: boolean;
  signup_date: string | null;
}

interface ConnectionRequest {
  id: string;
  brand_id: string;
  brand_email: string | null;
  influencer_id: string;
  message: string | null;
  status: string;
  created_at: string;
  influencers: { name: string; username: string } | null;
}

const NICHES = [
  "Fashion & Clothing", "Health & Fitness", "Beauty & Skincare",
  "Food & Nutrition", "Travel & Lifestyle", "Tech & Gaming",
  "Parenting & Family", "Finance & Business", "Home & Interior", "Sports & Fitness",
];

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSVDate(str: string): string | null {
  if (!str) return null;
  try {
    const [datePart, timePart] = str.trim().split(" ");
    const [day, month, year] = datePart.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart || "00:00:00"}Z`;
  } catch { return null; }
}

function parseCSV(text: string): ParsedInfluencer[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const username = (cols[6] ?? "").trim().replace(/^@/, "").toLowerCase();
    const name = (cols[1] ?? "").trim();
    if (!username || !name) return null;
    return {
      name, username,
      email: (cols[2] ?? "").trim() || null,
      phone: (cols[4] ?? "").trim() || null,
      niche_audience: (cols[7] ?? "").trim() || null,
      geography: "United Kingdom",
      barter_open: (cols[5] ?? "").trim().toLowerCase() === "yes",
      signup_date: parseCSVDate((cols[0] ?? "").trim()),
    } as ParsedInfluencer;
  }).filter(Boolean) as ParsedInfluencer[];
}

function formatN(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Accepted</span>;
  if (status === "declined")
    return <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><XCircle className="w-3.5 h-3.5" />Declined</span>;
  return <span className="flex items-center gap-1 text-xs text-amber-400 font-medium"><Clock className="w-3.5 h-3.5" />Pending</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MasterAdmin() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // CSV import
  const [parsed, setParsed] = useState<ParsedInfluencer[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Lookup
  const [lookupUsername, setLookupUsername] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupProfile, setLookupProfile] = useState<IGProfile | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupNiche, setLookupNiche] = useState("Fashion & Clothing");
  const [lookupBarter, setLookupBarter] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; errors: number } | null>(null);

  // Requests
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Auth gate ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !MASTER_ADMIN_EMAILS.includes(user.email ?? "")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This page is restricted to the master admin account only.
            </p>
          </div>
          {user && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Logged in as: <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Please log out and sign in as <span className="font-medium text-foreground">admin@marketers.quest</span>
          </p>
          <Link to="/dashboard" className="block text-xs text-primary hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Queries ──
  const { data: requests = [], isLoading: reqLoading } = useQuery<ConnectionRequest[]>({
    queryKey: ["master_connection_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connection_requests")
        .select("*, influencers(name, username)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConnectionRequest[];
    },
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // ── Handlers ──

  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setParsed(parseCSV(e.target?.result as string));
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsed.length) return;
    setImporting(true);
    setImportResult(null);
    let added = 0, skipped = 0;
    for (let i = 0; i < parsed.length; i += 10) {
      const batch = parsed.slice(i, i + 10).map((p) => ({ user_id: user.id, ...p }));
      const { error } = await supabase.from("influencers").upsert(batch, { onConflict: "username" });
      if (error) {
        for (const row of batch) {
          const { error: e2 } = await supabase.from("influencers").insert(row);
          if (e2) skipped++; else added++;
        }
      } else added += batch.length;
    }
    setImporting(false);
    setImportResult({ added, skipped });
    qc.invalidateQueries({ queryKey: ["influencers"] });
    toast.success(`${added} influencers imported${skipped ? `, ${skipped} skipped` : ""}.`);
    setParsed([]); setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleLookup = async () => {
    const u = lookupUsername.trim().replace(/^@/, "");
    if (!u) return;
    setLookupLoading(true); setLookupProfile(null); setLookupError(null);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-instagram-profile", { body: { username: u } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setLookupProfile(data.profile);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Profile not found");
    }
    setLookupLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!lookupProfile) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-instagram-profile", {
        body: { username: lookupProfile.username, save: true, niche_audience: lookupNiche, barter_open: lookupBarter },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["influencers"] });
      toast.success(`${lookupProfile.name} added to the influencer dashboard!`);
      setLookupProfile(null); setLookupUsername("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-instagram-data");
      if (error) throw error;
      setSyncResult({ updated: data.updated ?? 0, errors: data.errors ?? 0 });
      qc.invalidateQueries({ queryKey: ["influencers"] });
      toast.success(`${data.updated} profiles updated.`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Sync failed"); }
    setSyncing(false);
  };

  const updateStatus = async (id: string, status: "accepted" | "declined" | "pending") => {
    setUpdatingId(id);
    const { error } = await supabase.from("connection_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["master_connection_requests"] });
    setUpdatingId(null);
  };

  // ── Render ──

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            Marketers Quest
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
              <ShieldCheck className="w-3 h-3" /> Master Admin
            </span>
          </h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Link to="/dashboard" className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to dashboard
        </Link>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Tabs defaultValue="lookup" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border p-1 h-auto">
            <TabsTrigger value="lookup" className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
              Creator Lookup
            </TabsTrigger>
            <TabsTrigger value="import" className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
              CSV Import
            </TabsTrigger>
            <TabsTrigger value="requests" className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm flex items-center gap-1.5">
              Connection Requests
              {pendingCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold leading-none">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sync" className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
              Instagram Sync
            </TabsTrigger>
          </TabsList>

          {/* ── Creator Lookup ── */}
          <TabsContent value="lookup" className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">Creator Lookup</h2>
              <p className="text-sm text-muted-foreground">
                Look up any public Instagram Business or Creator account by username. Review their live stats and add them to the influencer dashboard.
              </p>
            </div>

            <div className="flex gap-2 max-w-md">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                <Input
                  className="pl-7"
                  placeholder="username"
                  value={lookupUsername}
                  onChange={(e) => setLookupUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                />
              </div>
              <Button onClick={handleLookup} disabled={lookupLoading || !lookupUsername.trim()} className="gap-2">
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {lookupLoading ? "Looking up…" : "Lookup"}
              </Button>
            </div>

            {lookupError && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 max-w-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {lookupError}
              </div>
            )}

            {lookupProfile && (
              <div className="rounded-xl border border-border bg-card p-5 max-w-lg space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    {lookupProfile.profile_picture_url && <AvatarImage src={lookupProfile.profile_picture_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {lookupProfile.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground text-base">{lookupProfile.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Instagram className="w-3.5 h-3.5 text-pink-400" />@{lookupProfile.username}
                    </p>
                    {lookupProfile.website && (
                      <a href={lookupProfile.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline">{lookupProfile.website}</a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatN(lookupProfile.followers_count)}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground tabular-nums">{lookupProfile.media_count}</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                </div>

                {lookupProfile.biography && (
                  <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                    {lookupProfile.biography}
                  </p>
                )}

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Set before adding to dashboard</p>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Niche</label>
                      <Select value={lookupNiche} onValueChange={setLookupNiche}>
                        <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NICHES.map((n) => <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Open to barter?</label>
                      <div className="flex gap-2">
                        <Button size="sm" variant={lookupBarter ? "default" : "outline"} className="h-8 text-xs px-3" onClick={() => setLookupBarter(true)}>Yes</Button>
                        <Button size="sm" variant={!lookupBarter ? "default" : "outline"} className="h-8 text-xs px-3" onClick={() => setLookupBarter(false)}>No</Button>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {saving ? "Adding…" : "Add to Dashboard"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── CSV Import ── */}
          <TabsContent value="import" className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">CSV Import</h2>
              <p className="text-sm text-muted-foreground">
                Upload the CSV exported from the influencer contact form. Columns are mapped automatically.
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              {fileName ? (
                <p className="text-sm font-medium text-foreground flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />{fileName} — {parsed.length} creators found
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Drop CSV here or <span className="text-primary">browse</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Influencer Contact Form CSV export</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {parsed.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Preview — first {Math.min(5, parsed.length)} of {parsed.length} rows
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        {["Name", "@Handle", "Niche", "Barter", "Email"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-2.5 font-medium">{row.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            <span className="flex items-center gap-1"><Instagram className="w-3 h-3 text-pink-400" />@{row.username}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            {row.niche_audience ? <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{row.niche_audience}</span> : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs">{row.barter_open ? <span className="text-emerald-400">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.email ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button disabled={!parsed.length || importing} onClick={handleImport} className="gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? "Importing…" : `Import ${parsed.length} influencers`}
              </Button>
              {importResult && (
                <span className="text-sm text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {importResult.added} imported{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Expected columns: <strong>Date, From, Email, Subject, Phone, Barter, IG Username, Industry</strong>
            </p>
          </TabsContent>

          {/* ── Connection Requests ── */}
          <TabsContent value="requests" className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
                Connection Requests
                {pendingCount > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">{pendingCount} pending</Badge>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">Brands requesting to collaborate with your creators.</p>
            </div>

            {reqLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : requests.length === 0 ? (
              <div className="rounded-xl border border-border bg-card flex items-center justify-center py-16 text-muted-foreground text-sm">
                No connection requests yet.
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid bg-muted/30 border-b border-border px-4 py-2.5" style={{ gridTemplateColumns: "1fr 1fr 2fr 100px 160px" }}>
                  {["Influencer", "Brand", "Message", "Status", "Actions"].map((h) => (
                    <span key={h} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{h}</span>
                  ))}
                </div>
                {requests.map((req, i) => (
                  <div key={req.id}
                    className={`grid items-center px-4 py-3 border-b border-border last:border-0 ${i % 2 === 0 ? "bg-card" : "bg-background"}`}
                    style={{ gridTemplateColumns: "1fr 1fr 2fr 100px 160px" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{req.influencers?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Instagram className="w-3 h-3 text-pink-400" />@{req.influencers?.username ?? "—"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{req.brand_email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="min-w-0 pr-4">
                      {req.message
                        ? <p className="text-sm text-muted-foreground italic truncate">"{req.message}"</p>
                        : <span className="text-xs text-muted-foreground/40">No message</span>}
                    </div>
                    <StatusBadge status={req.status} />
                    <div className="flex items-center gap-1.5">
                      {req.status === "pending" ? (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            disabled={updatingId === req.id} onClick={() => updateStatus(req.id, "accepted")}>
                            {updatingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Accept
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                            disabled={updatingId === req.id} onClick={() => updateStatus(req.id, "declined")}>
                            <XCircle className="w-3 h-3" /> Decline
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                          onClick={() => updateStatus(req.id, "pending")}>Reset</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Instagram Sync ── */}
          <TabsContent value="sync" className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-400" /> Instagram Data Sync
              </h2>
              <p className="text-sm text-muted-foreground">
                Fetch live follower counts and profile pictures for all creators via Meta Business Discovery API.
                Run this after importing a new CSV or whenever you want to refresh the data.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5 max-w-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">Sync all influencer profiles</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Updates <strong>followers</strong> and <strong>profile picture</strong> for every creator with an Instagram handle.
                </p>
                {syncResult && (
                  <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Last run: {syncResult.updated} updated{syncResult.errors > 0 ? `, ${syncResult.errors} failed` : ""}
                  </p>
                )}
              </div>
              <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2 flex-shrink-0">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-pink-400" />}
                {syncing ? "Syncing…" : "Sync Now"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
