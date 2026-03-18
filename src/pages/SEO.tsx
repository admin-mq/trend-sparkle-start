import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Globe, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { seoSupabase } from "@/lib/seoSupabaseClient";
import { startQueuedSeoScan } from "@/lib/sccFakeProcessor";

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
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [activeSiteUrl, setActiveSiteUrl] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [rotatingIdx, setRotatingIdx] = useState(0);

  // Rotating message timer while the scan is being queued / redirected
  useEffect(() => {
    if (scanStatus !== "running") return;
    const interval = setInterval(() => {
      setRotatingIdx((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [scanStatus]);

  const handleRunScan = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    setScanError(null);

    const {
      data: { user },
      error: userError,
    } = await seoSupabase.auth.getUser();

    if (userError || !user) {
      setError("You're not logged in. Please log in again and retry.");
      setIsSubmitting(false);
      return;
    }

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError("Enter a website URL");
      setIsSubmitting(false);
      return;
    }

    const normalized = normalizeUrl(trimmed);
    if (!normalized || normalized === "https://") {
      setError("Please enter a valid URL");
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: siteRow, error: siteErr } = await (seoSupabase as any)
        .from("scc_sites")
        .upsert({ user_id: user.id, site_url: normalized }, { onConflict: "user_id,site_url" })
        .select("id")
        .single();

      if (siteErr || !siteRow?.id) {
        setError(siteErr?.message || "Failed to create or fetch site");
        setIsSubmitting(false);
        return;
      }

      setActiveSiteId(siteRow.id);
      setActiveSiteUrl(normalized);
      setScanStatus("running");

      const { snapshotId } = await startQueuedSeoScan({
        siteId: siteRow.id,
        seedUrl: normalized,
        mode: "seo_intelligence",
        maxPages: 8,
        maxDepth: 1,
      });

      setActiveSnapshotId(snapshotId);
      setScanStatus("success");

      navigate(`/seo/results?snapshot=${snapshotId}`);
    } catch (err: any) {
      console.error("Scan error:", err);
      setScanStatus("failed");
      setScanError(err?.message || "An unexpected error occurred while starting the scan");
      setError(err?.message || "An unexpected error occurred while starting the scan");
    } finally {
      setIsSubmitting(false);
    }
  }, [urlInput, navigate]);

  const handleRetry = () => {
    setScanStatus("idle");
    setActiveSnapshotId(null);
    setActiveSiteId(null);
    setActiveSiteUrl(null);
    setScanError(null);
    setError(null);
  };

  // ── Idle state ──
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
              <p className="text-muted-foreground text-sm">Enter your website URL to run a full intelligence scan.</p>
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

              <Button className="w-full" onClick={handleRunScan} disabled={isSubmitting || !urlInput.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Run Intelligence Scan"
                )}
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Running state ──
  if (scanStatus === "running") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-8">
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
            <p className="text-muted-foreground text-sm h-6 transition-opacity duration-500" key={rotatingIdx}>
              {ROTATING_MESSAGES[rotatingIdx]}
            </p>
            {activeSiteUrl && <p className="text-xs text-muted-foreground/80 break-all">{activeSiteUrl}</p>}
          </div>

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
              {scanError || "Something went wrong while scanning. Please try again."}
            </p>
            <Button variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success fallback ──
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">Scan Started</h2>
          <p className="text-sm text-muted-foreground">Your scan has been queued successfully.</p>
          <Button
            variant="outline"
            onClick={() => activeSnapshotId && navigate(`/seo/results?snapshot=${activeSnapshotId}`)}
            disabled={!activeSnapshotId}
          >
            View Results
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SEO;
