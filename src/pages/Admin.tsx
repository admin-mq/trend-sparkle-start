import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Upload, Sparkles, Users, Loader2, CheckCircle2, XCircle,
  Clock, Instagram, ArrowLeft, FileText, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  influencers: {
    name: string;
    username: string;
    niche_audience: string | null;
  } | null;
}

// ── CSV Parser ─────────────────────────────────────────────────────────────────

function parseCSVDate(str: string): string | null {
  if (!str) return null;
  try {
    // Format: "03/03/2026 16:33:54"  (DD/MM/YYYY HH:MM:SS)
    const [datePart, timePart] = str.trim().split(" ");
    const [day, month, year] = datePart.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart || "00:00:00"}Z`;
  } catch {
    return null;
  }
}

function parseCSV(text: string): ParsedInfluencer[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  return lines
    .slice(1) // skip header row
    .map((line) => {
      // Simple split — works for this CSV format (no quoted commas in data)
      const cols = line.split(",");
      const username = (cols[6] ?? "").trim().replace(/^@/, "").toLowerCase();
      const name = (cols[1] ?? "").trim();
      if (!username || !name) return null;

      return {
        name,
        username,
        email: (cols[2] ?? "").trim() || null,
        phone: (cols[4] ?? "").trim() || null,
        niche_audience: (cols[7] ?? "").trim() || null,
        geography: "United Kingdom",
        barter_open: (cols[5] ?? "").trim().toLowerCase() === "yes",
        signup_date: parseCSVDate((cols[0] ?? "").trim()),
      } as ParsedInfluencer;
    })
    .filter(Boolean) as ParsedInfluencer[];
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
      </span>
    );
  if (status === "declined")
    return (
      <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
        <XCircle className="w-3.5 h-3.5" /> Declined
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
      <Clock className="w-3.5 h-3.5" /> Pending
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedInfluencer[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Connection requests query ──
  const { data: requests = [], isLoading: reqLoading } = useQuery<ConnectionRequest[]>({
    queryKey: ["admin_connection_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connection_requests")
        .select("*, influencers(name, username, niche_audience)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConnectionRequest[];
    },
    enabled: !!user,
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // ── File handling ──
  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setParsed(rows);
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Import ──
  const handleImport = async () => {
    if (!parsed.length || !user) return;
    setImporting(true);
    setImportResult(null);

    let added = 0;
    let skipped = 0;

    // Batch in groups of 10 to avoid timeouts
    const BATCH = 10;
    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH).map((p) => ({
        user_id: user.id,
        ...p,
      }));
      const { error } = await supabase.from("influencers").upsert(batch, {
        onConflict: "username",
        ignoreDuplicates: false,
      });
      if (error) {
        // If upsert fails (e.g. no unique constraint), fall back to individual inserts
        for (const row of batch) {
          const { error: insErr } = await supabase.from("influencers").insert(row);
          if (insErr) skipped++;
          else added++;
        }
      } else {
        added += batch.length;
      }
    }

    setImporting(false);
    setImportResult({ added, skipped });
    qc.invalidateQueries({ queryKey: ["influencers"] });
    toast({
      title: `Import complete`,
      description: `${added} influencers imported${skipped ? `, ${skipped} skipped` : ""}.`,
    });
    setParsed([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Update request status ──
  const updateStatus = async (id: string, status: "accepted" | "declined") => {
    setUpdatingId(id);
    const { error } = await supabase
      .from("connection_requests")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["admin_connection_requests"] });
    }
    setUpdatingId(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">Please sign in to access admin.</p>
          <Link to="/" className="text-primary text-sm hover:underline">Go to dashboard</Link>
        </div>
      </div>
    );
  }

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
        <Link to="/influencers" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Influencers
        </Link>
        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">Admin</span>
      </header>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-10">

        {/* ── CSV Import ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Import Influencers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload the CSV exported from the influencer contact form. All columns are mapped automatically.
            </p>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50 hover:bg-muted/20"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            {fileName ? (
              <p className="text-sm font-medium text-foreground flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {fileName}
                <span className="text-muted-foreground font-normal">
                  — {parsed.length} creators found
                </span>
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drop your CSV file here or <span className="text-primary">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports the Influencer Contact Form CSV export format
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="mt-4 rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Preview — first {Math.min(5, parsed.length)} of {parsed.length} rows
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Name</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">@Handle</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Niche</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Barter</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Instagram className="w-3 h-3 text-pink-400" />@{row.username}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.niche_audience ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {row.niche_audience}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {row.barter_open ? (
                            <span className="text-xs text-emerald-400">Yes</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.email ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import button + result */}
          <div className="mt-4 flex items-center gap-4">
            <Button
              disabled={!parsed.length || importing}
              onClick={handleImport}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing ? "Importing…" : `Import ${parsed.length} influencers`}
            </Button>

            {importResult && (
              <span className="text-sm text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {importResult.added} imported
                {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
              </span>
            )}
          </div>

          {/* Format hint */}
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Expected columns: <strong>Date, From, Email, Subject, Phone, Barter, IG Username, Industry</strong>.
              Geography defaults to <em>United Kingdom</em>.
            </span>
          </div>
        </section>

        {/* ── Connection Requests ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Connection Requests
                {pendingCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                    {pendingCount} pending
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Brands that have requested to collaborate with your creators.
              </p>
            </div>
          </div>

          {reqLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Users className="w-8 h-8 opacity-25" />
              <p className="text-sm">No connection requests yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid bg-muted/30 border-b border-border px-4 py-2.5"
                style={{ gridTemplateColumns: "1fr 1fr 2fr 100px 160px" }}>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Influencer</span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Brand</span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</span>
              </div>

              {requests.map((req, i) => (
                <div
                  key={req.id}
                  className={`grid items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/10 transition-colors ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  }`}
                  style={{ gridTemplateColumns: "1fr 1fr 2fr 100px 160px" }}
                >
                  {/* Influencer */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {req.influencers?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Instagram className="w-3 h-3 text-pink-400" />
                      @{req.influencers?.username ?? "—"}
                    </p>
                  </div>

                  {/* Brand */}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{req.brand_email ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Message */}
                  <div className="min-w-0 pr-4">
                    {req.message ? (
                      <p className="text-sm text-muted-foreground italic truncate">"{req.message}"</p>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">No message</span>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge status={req.status} />

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {req.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, "accepted")}
                        >
                          {updatingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, "declined")}
                        >
                          <XCircle className="w-3 h-3" />
                          Decline
                        </Button>
                      </>
                    )}
                    {req.status !== "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => updateStatus(req.id, "pending")}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
