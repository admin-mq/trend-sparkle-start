import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const REQUIRED_HEADERS = ["Name", "Username", "Followers", "Niche Audience", "Geography"];

interface ParsedRow {
  name: string;
  username: string;
  followers: number;
  niche_audience: string;
  geography: string;
}

interface Props {
  onBulkUpload: (rows: ParsedRow[]) => Promise<boolean>;
}

function downloadTemplate() {
  const csv = `Name,Username,Followers,Niche Audience,Geography\nJane Doe,@janetech,50000,Tech & Gadgets,USA\nAlex Smith,@alex_travels,125000,Luxury Travel,UK\nMaria Garcia,@mariacooks,8500,Vegan Recipes,Spain`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "influencers_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkUploadModal({ onBulkUpload }: Props) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParsedRows([]);
    setError("");
    setUploading(false);
    setProgress(0);
    setDone(false);
  };

  const parseFile = useCallback((file: File) => {
    reset();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (!json.length) {
          setError("The file is empty.");
          return;
        }

        const headers = Object.keys(json[0]);
        const missing = REQUIRED_HEADERS.filter(
          (h) => !headers.some((hh) => hh.toLowerCase().trim() === h.toLowerCase())
        );

        if (missing.length) {
          setError(`Missing required headers: ${missing.join(", ")}`);
          return;
        }

        const rows: ParsedRow[] = json.map((row) => {
          const get = (key: string) => {
            const found = Object.entries(row).find(([k]) => k.toLowerCase().trim() === key.toLowerCase());
            return found ? String(found[1] ?? "") : "";
          };
          const username = get("Username");
          return {
            name: get("Name"),
            username: username.startsWith("@") ? username : `@${username}`,
            followers: parseInt(get("Followers")) || 0,
            niche_audience: get("Niche Audience"),
            geography: get("Geography"),
          };
        }).filter((r) => r.name && r.username);

        if (!rows.length) {
          setError("No valid rows found after parsing.");
          return;
        }

        setParsedRows(rows);
      } catch {
        setError("Failed to parse file. Please use a valid CSV or Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleUpload = async () => {
    setUploading(true);
    setProgress(10);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 15, 90)), 300);
    const ok = await onBulkUpload(parsedRows);
    clearInterval(interval);
    setProgress(100);
    setUploading(false);
    if (ok) setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-4 w-4" /> Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Influencers</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-sm font-medium text-foreground">Successfully imported {parsedRows.length} influencer{parsedRows.length !== 1 ? "s" : ""}!</p>
            <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(false); }}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Drop your CSV or Excel file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>

            {/* Download template */}
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-primary hover:underline mx-auto">
              <Download className="h-3.5 w-3.5" /> Download Sample Template
            </button>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Preview */}
            {parsedRows.length > 0 && !error && (
              <div className="space-y-3">
                <p className="text-sm text-foreground font-medium">{parsedRows.length} influencer{parsedRows.length !== 1 ? "s" : ""} ready to import</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border text-xs">
                  <table className="w-full">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Username</th>
                        <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Followers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-foreground">{r.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.username}</td>
                          <td className="px-3 py-1.5 text-right text-foreground">{r.followers.toLocaleString()}</td>
                        </tr>
                      ))}
                      {parsedRows.length > 10 && (
                        <tr><td colSpan={3} className="px-3 py-1.5 text-muted-foreground text-center">…and {parsedRows.length - 10} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {uploading && <Progress value={progress} className="h-2" />}

                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? "Importing..." : `Import ${parsedRows.length} Influencer${parsedRows.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
