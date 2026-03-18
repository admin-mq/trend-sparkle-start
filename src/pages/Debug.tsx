import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { seoSupabase } from "@/lib/seoSupabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Debug = () => {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const out: Record<string, any> = {};

    // 1. Main Supabase URL
    const mainUrl = (supabase as any).supabaseUrl ?? "unknown";
    out.mainSupabaseUrl = mainUrl;
    console.log("[Debug] Main Supabase URL:", mainUrl);

    // 2. SEO Supabase URL
    const seoUrl = (seoSupabase as any).supabaseUrl ?? "unknown";
    out.seoSupabaseUrl = seoUrl;
    console.log("[Debug] SEO Supabase URL:", seoUrl);

    // 3. Main session check
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    out.mainSession = sessionError ? { error: sessionError.message } : { user: sessionData.session?.user?.email ?? "no session" };
    console.log("[Debug] Main getSession:", out.mainSession);

    // 4. SEO session check
    const { data: seoSessionData, error: seoSessionError } = await seoSupabase.auth.getSession();
    out.seoSession = seoSessionError ? { error: seoSessionError.message } : { user: seoSessionData.session?.user?.email ?? "no session" };
    console.log("[Debug] SEO getSession:", out.seoSession);

    // 5. scc_snapshots count (SEO project)
    const { count: snapCount, error: snapErr } = await (seoSupabase as any)
      .from("scc_snapshots")
      .select("*", { count: "exact", head: true });
    out.scc_snapshots = snapErr ? { error: snapErr.message, code: snapErr.code } : { count: snapCount };
    console.log("[Debug] scc_snapshots count:", out.scc_snapshots);

    // 6. scc_crawl_jobs count (SEO project)
    const { count: jobCount, error: jobErr } = await (seoSupabase as any)
      .from("scc_crawl_jobs")
      .select("*", { count: "exact", head: true });
    out.scc_crawl_jobs = jobErr ? { error: jobErr.message, code: jobErr.code } : { count: jobCount };
    console.log("[Debug] scc_crawl_jobs count:", out.scc_crawl_jobs);

    setResults(out);
    setLoading(false);
  };

  useEffect(() => { runDiagnostics(); }, []);

  return (
    <div className="min-h-screen bg-background p-8 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Supabase Debug</h1>
      <p className="text-sm text-muted-foreground">Two clients: Main (Lovable Cloud) + SEO (external)</p>
      <Button onClick={runDiagnostics} disabled={loading}>
        {loading ? "Running…" : "Re-run Diagnostics"}
      </Button>
      {Object.entries(results).map(([key, val]) => (
        <Card key={key} className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground">{key}</p>
            <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
              {JSON.stringify(val, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Debug;
