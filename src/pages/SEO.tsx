import { useState, useEffect, useCallback } from "react";
import { Search, Globe, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const ROTATING_MESSAGES = [
  "Discovering your website structure…",
  "Evaluating indexation signals…",
  "Mapping page hierarchy…",
  "Detecting schema & metadata…",
  "Preparing high-impact recommendations…",
];

const PROGRESS_STEPS = ["Discovering", "Analyzing", "Calculating", "Finalizing"];

function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url.replace(/^http:\/\//i, "https://");
}

const SEO = () => {
  const { user } = useAuthContext();
  const { toast } = useToast();

  const [urlInput, setUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scan state
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [rotatingIdx, setRotatingIdx] = useState(0);

  // Rotating message timer
  useEffect(() => {
    if (scanStatus !== "running") return;
    const interval = setInterval(() => {
      setRotatingIdx((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [scanStatus]);

  // Polling for snapshot status
  useEffect(() => {
    if (!activeSnapshotId || scanStatus !== "running") return;
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("scc_snapshots")
        .select("status")
        .eq("id", activeSnapshotId)
        .single();

      if (error) return;
      if (data?.status === "success") {
        setScanStatus("success");
        clearInterval(interval);
      } else if (data?.status === "failed") {
        setScanStatus("failed");
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeSnapshotId, scanStatus]);

  const handleRunScan = useCallback(async () => {
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }
    const normalized = normalizeUrl(urlInput);
    if (!normalized || normalized === "https://") {
      toast({ title: "Please enter a valid URL", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upsert site
      const { data: siteData, error: siteError } = await supabase
        .from("scc_sites")
        .upsert(
          { user_id: user.id, site_url: normalized },
          { onConflict: "user_id,site_url" }
        )
        .select("id")
        .single();

      if (siteError) throw siteError;

      // 2. Create snapshot
      const { data: snapData, error: snapError } = await supabase
        .from("scc_snapshots")
        .insert({
          site_id: siteData.id,
          status: "running",
          mode: "crawl_only",
          started_at: new Date().toISOString(),
          progress_step: "discovering",
        })
        .select("id")
        .single();

      if (snapError) throw snapError;

      setActiveSnapshotId(snapData.id);
      setScanStatus("running");
    } catch (err: any) {
      console.error("Scan error:", err);
      toast({ title: "Failed to start scan", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, urlInput, toast]);

  // ── Idle state: URL input ──
  if (scanStatus === "idle") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="w-full max-w-lg border-border bg-card">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
                <Search className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Search Performance Command Center</h1>
              <p className="text-muted-foreground text-sm">
                Enter your website URL to run a full intelligence scan.
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="example.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleRunScan()}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleRunScan}
                disabled={isSubmitting || !urlInput.trim()}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                ) : (
                  "Run Intelligence Scan"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Running state: animated loading ──
  if (scanStatus === "running") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-8">
          {/* Pulsing icon */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-primary/20 loading-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-9 h-9 text-primary" />
            </div>
            <div
              className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin"
              style={{ borderTopColor: "hsl(var(--primary))", animationDuration: "2s" }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Running Your Intelligence Scan</h2>
            <p
              className="text-muted-foreground text-sm h-6 transition-opacity duration-500"
              key={rotatingIdx}
            >
              {ROTATING_MESSAGES[rotatingIdx]}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-6">
            {PROGRESS_STEPS.map((step, idx) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                    idx <= Math.floor(rotatingIdx / (ROTATING_MESSAGES.length / PROGRESS_STEPS.length))
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
                <span className="text-xs text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Failed state ──
  if (scanStatus === "failed") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/30 bg-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-destructive/15 flex items-center justify-center mx-auto">
              <Search className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Scan Failed</h2>
            <p className="text-muted-foreground text-sm">
              Something went wrong while scanning. Please try again.
            </p>
            <Button variant="outline" onClick={() => { setScanStatus("idle"); setActiveSnapshotId(null); }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success state (placeholder for results view) ──
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Scan Complete</h2>
          <p className="text-muted-foreground text-sm">
            Results view coming soon.
          </p>
          <Button variant="outline" onClick={() => { setScanStatus("idle"); setActiveSnapshotId(null); }}>
            Run Another Scan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SEO;
