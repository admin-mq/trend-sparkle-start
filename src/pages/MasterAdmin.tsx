import { useState, useRef } from "react";
import {
  Loader2, Upload, CheckCircle2, XCircle,
  Sparkles, HelpCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const NICHES = [
  "Fashion & Clothing", "Health & Fitness", "Beauty & Skincare",
  "Food & Nutrition", "Travel & Lifestyle", "Tech & Gaming",
  "Parenting & Family", "Finance & Business", "Home & Interior", "Sports & Fitness",
];

type RowStatus = "pending" | "fetching" | "done" | "error";

interface Row {
  username: string;
  followers: number;
  niche: string;
  barter: boolean;
  status: RowStatus;
  name?: string;
  avatar?: string;
  error?: string;
}

function parseLines(text: string, defaultNiche: string, defaultBarter: boolean): Row[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const username = parts[0].replace(/^@/, "").toLowerCase();
      const followers = parseInt(parts[1]?.replace(/[^0-9]/g, "") || "0", 10) || 0;
      const niche = parts[2] || defaultNiche;
      const barter = parts[3] ? parts[3].toLowerCase() === "yes" : defaultBarter;
      return { username, followers, niche, barter, status: "pending" as RowStatus };
    });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MasterAdmin() {
  const [text, setText] = useState("");
  const [niche, setNiche] = useState("Fashion & Clothing");
  const [barter, setBarter] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  const doneCount = rows.filter((r) => r.status === "done").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const totalCount = rows.length;
  const progress = totalCount ? Math.round(((doneCount + errorCount) / totalCount) * 100) : 0;

  const handleUpload = async () => {
    const parsed = parseLines(text, niche, barter);
    if (!parsed.length) return;
    setRows(parsed);
    setRunning(true);
    abortRef.current = false;

    for (let i = 0; i < parsed.length; i++) {
      if (abortRef.current) break;

      setRows((prev) =>
        prev.map((r, j) => (j === i ? { ...r, status: "fetching" } : r))
      );

      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "lookup-instagram-profile",
          {
            body: {
              username: parsed[i].username,
              save: true,
              followers: parsed[i].followers,
              niche_audience: parsed[i].niche,
              barter_open: parsed[i].barter,
            },
          }
        );
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status: "done",
                  name: data.profile?.name || parsed[i].username,
                  avatar: data.profile?.avatar_url,
                }
              : r
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed";
        setRows((prev) =>
          prev.map((r, j) => (j === i ? { ...r, status: "error", error: msg } : r))
        );
      }

      if (i < parsed.length - 1) await delay(1200);
    }

    setRunning(false);
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const handleReset = () => {
    setRows([]);
    setText("");
    abortRef.current = false;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            Marketers Quest
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
              Creator Upload
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Bulk-add creators to the influencer dashboard</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {rows.length === 0 ? (
          /* ── INPUT STATE ── */
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Upload Creator Usernames</h1>
              <p className="text-sm text-muted-foreground">
                One username per line. Optionally add follower count:{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">username, 45000</code>
              </p>
            </div>

            {/* Textarea */}
            <Textarea
              className="font-mono text-sm min-h-[220px] resize-y"
              placeholder={`cristiano\nkyliejenner, 380000000\ntherock, 95000000\nneymarjr`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />

            {/* Defaults */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  Default niche
                  <HelpCircle className="w-3 h-3" />
                </label>
                <Select value={niche} onValueChange={setNiche}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NICHES.map((n) => (
                      <SelectItem key={n} value={n} className="text-sm">{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Default barter open?</label>
                <div className="flex gap-2">
                  <Button size="sm" variant={barter ? "default" : "outline"} className="flex-1 h-9 text-sm" onClick={() => setBarter(true)}>Yes</Button>
                  <Button size="sm" variant={!barter ? "default" : "outline"} className="flex-1 h-9 text-sm" onClick={() => setBarter(false)}>No</Button>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              disabled={!text.trim()}
              onClick={handleUpload}
            >
              <Upload className="w-4 h-4" />
              Start Upload ({parseLines(text, niche, barter).length} creators)
            </Button>
          </div>
        ) : (
          /* ── PROGRESS STATE ── */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">Uploading Creators</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {doneCount} saved · {errorCount} failed · {totalCount - doneCount - errorCount} remaining
                </p>
              </div>
              <div className="flex gap-2">
                {running ? (
                  <Button variant="outline" size="sm" onClick={handleStop}>Stop</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleReset}>Upload more</Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <Progress value={progress} className="h-2" />

            {/* Rows table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-6">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Username</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Name fetched</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.username + i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        @{row.username}
                        {row.followers > 0 && (
                          <span className="ml-2 text-muted-foreground">
                            {row.followers >= 1_000_000
                              ? `${(row.followers / 1_000_000).toFixed(1)}M`
                              : row.followers >= 1_000
                              ? `${(row.followers / 1_000).toFixed(0)}k`
                              : row.followers}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {row.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === "pending" && (
                          <span className="text-xs text-muted-foreground">Waiting…</span>
                        )}
                        {row.status === "fetching" && (
                          <span className="text-xs text-primary flex items-center justify-end gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Fetching
                          </span>
                        )}
                        {row.status === "done" && (
                          <span className="text-xs text-emerald-400 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Saved
                          </span>
                        )}
                        {row.status === "error" && (
                          <span className="text-xs text-red-400 flex items-center justify-end gap-1" title={row.error}>
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!running && (
              <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
                errorCount === 0
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
              }`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Done! {doneCount} creator{doneCount !== 1 ? "s" : ""} added to the influencer dashboard.
                {errorCount > 0 && ` ${errorCount} failed — they may be private or not found.`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
