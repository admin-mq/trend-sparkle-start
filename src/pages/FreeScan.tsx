import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowRight, Lock, AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const SCAN_API = "https://njnnpdrevbkhbhzwccuz.supabase.co/functions/v1/public-scan";

const scanningMessages = [
  "Crawling your pages…",
  "Analysing SEO issues…",
  "Calculating revenue impact…",
  "Generating your report…",
];

interface MoneyData {
  total_monthly_loss_min?: number;
  total_monthly_loss_max?: number;
  currency_symbol?: string;
  market?: string;
  industry?: string;
  confidence_score?: number;
  estimated_monthly_traffic?: number;
  executive_summary?: string;
  safe_browsing_threat?: boolean;
}

function formatMoney(n: number, sym: string) {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sym}${Math.round(n)}`;
}

type Step = "input" | "scanning" | "results" | "error";

export default function FreeScan() {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [anonToken, setAnonToken] = useState<string | null>(null);
  const [money, setMoney] = useState<MoneyData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Rotating messages
  useEffect(() => {
    if (step !== "scanning") return;
    const iv = setInterval(() => setMsgIndex((i) => (i + 1) % scanningMessages.length), 3000);
    return () => clearInterval(iv);
  }, [step]);

  // Fake progress
  useEffect(() => {
    if (step !== "scanning") return;
    const iv = setInterval(() => setProgress((p) => Math.min(p + 2, 90)), 800);
    return () => clearInterval(iv);
  }, [step]);

  // Poll for completion
  useEffect(() => {
    if (step !== "scanning" || !anonToken) return;
    const iv = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("scc_snapshots")
          .select("status, notes")
          .eq("anon_token", anonToken)
          .single();
        if (!data) return;
        if (data.status === "completed") {
          clearInterval(iv);
          setProgress(100);
          try {
            const parsed = typeof data.notes === "string" ? JSON.parse(data.notes) : data.notes;
            setMoney(parsed?.money || null);
          } catch { setMoney(null); }
          setTimeout(() => setStep("results"), 600);
        } else if (data.status === "failed") {
          clearInterval(iv);
          setErrorMsg("The scan encountered an error. Please try again.");
          setStep("error");
        }
      } catch {}
    }, 2500);
    return () => clearInterval(iv);
  }, [step, anonToken]);

  const handleSubmit = useCallback(async () => {
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    setRateLimited(false);
    try {
      const res = await fetch(SCAN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (json.rate_limited) {
        setRateLimited(true);
        setStep("error");
        return;
      }
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong");
        setStep("error");
        return;
      }
      setSnapshotId(json.snapshot_id);
      setAnonToken(json.anon_token);
      if (json.status === "completed" || json.cached) {
        // Fetch notes immediately
        const { data } = await supabase
          .from("scc_snapshots")
          .select("notes")
          .eq("id", json.snapshot_id)
          .single();
        if (data?.notes) {
          try {
            const parsed = typeof data.notes === "string" ? JSON.parse(data.notes) : data.notes;
            setMoney(parsed?.money || null);
          } catch { setMoney(null); }
        }
        setProgress(100);
        setStep("results");
      } else {
        setProgress(5);
        setMsgIndex(0);
        setStep("scanning");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }, [url, submitting]);

  const reset = () => {
    setStep("input");
    setProgress(5);
    setMoney(null);
    setErrorMsg("");
    setRateLimited(false);
  };

  const currency = money?.currency_symbol || "$";
  const lossMin = Number(money?.total_monthly_loss_min);
  const lossMax = Number(money?.total_monthly_loss_max);
  const hasLoss = lossMin > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <Link to="/" className="text-xl font-bold text-foreground">
          Marketers Quest
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">

          {/* STEP 1: Input */}
          {step === "input" && (
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-tight">
                  Find out how much your website is losing every month
                </h1>
                <p className="text-muted-foreground text-lg">
                  Free instant scan — no signup needed
                </p>
              </div>
              <div className="space-y-3">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="h-14 text-lg px-5"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!url.trim() || submitting}
                  className="w-full h-14 text-lg font-semibold"
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Scan My Website <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                3 free scans per day · Takes ~60 seconds · No credit card
              </p>
            </div>
          )}

          {/* STEP 2: Scanning */}
          {step === "scanning" && (
            <div className="text-center space-y-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Scanning</p>
                <p className="text-foreground font-medium truncate">{url}</p>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-muted-foreground animate-pulse">
                {scanningMessages[msgIndex]}
              </p>
            </div>
          )}

          {/* STEP 3: Results */}
          {step === "results" && (
            <div className="space-y-6">
              {hasLoss ? (
                <Card className="border-l-4 border-l-destructive border-border">
                  <CardContent className="p-6 space-y-4 text-center">
                    <p className="text-muted-foreground text-sm">Your website could be losing</p>
                    <p className="text-4xl sm:text-5xl font-black text-destructive">
                      {formatMoney(lossMin, currency)}
                      {lossMax > lossMin ? ` – ${formatMoney(lossMax, currency)}` : ""}
                      <span className="text-lg font-medium text-muted-foreground ml-2">/ month</span>
                    </p>
                    {money?.executive_summary && (
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                        {money.executive_summary}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {money?.market && <Badge variant="secondary" className="text-[10px]">{money.market}</Badge>}
                      {money?.industry && <Badge variant="secondary" className="text-[10px] capitalize">{money.industry}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border">
                  <CardContent className="p-6 text-center">
                    <p className="text-foreground font-semibold text-lg">Scan complete!</p>
                    <p className="text-muted-foreground text-sm mt-1">Sign up to see your full report.</p>
                  </CardContent>
                </Card>
              )}

              {/* Blurred teaser */}
              <Card className="border-border relative overflow-hidden">
                <CardContent className="p-6 space-y-3 blur-sm select-none pointer-events-none">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm">
                  <Lock className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-foreground font-semibold text-lg">Full Report Available</p>
                  <p className="text-muted-foreground text-sm text-center max-w-xs mt-1 mb-4">
                    See every SEO issue, exact fixes, and page-by-page breakdown
                  </p>
                  <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white font-semibold">
                    <Link to="/auth">Get My Full Report — Sign Up Free</Link>
                  </Button>
                  <Link to="/auth" className="text-xs text-muted-foreground mt-3 hover:underline">
                    Already have an account? Sign in
                  </Link>
                </div>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                Connect this site to your dashboard after signing in for ongoing monitoring.
              </p>
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Scan another site
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Error / Rate Limit */}
          {step === "error" && (
            <div className="text-center space-y-6">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
              {rateLimited ? (
                <>
                  <p className="text-foreground font-semibold text-lg">
                    You've used your 3 free scans today
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Sign up for unlimited scans and full reports.
                  </p>
                  <Button asChild size="lg">
                    <Link to="/auth">Sign Up Free</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-foreground font-semibold text-lg">{errorMsg || "Something went wrong"}</p>
                  <Button onClick={reset} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-1" /> Try Again
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
