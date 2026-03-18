import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Debug = () => {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const out: Record<string, any> = {};

    // 1. Log Supabase URL
    const url = (supabase as any).supabaseUrl ?? (supabase as any).restUrl ?? "unknown";
    out.supabaseUrl = url;
    console.log("[Debug] Supabase URL:", url);
    console.log("[Debug] Client initialized:", !!supabase);

    // 2. Session check
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    out.session = sessionError ? { error: sessionError.message } : { user: sessionData.session?.user?.email ?? "no session" };
    console.log("[Debug] getSession:", out.session);

    // 3. scc_snapshots count
    const { count: snapCount, error: snapErr } = await (supabase as any)
      .from("scc_snapshots")
      .select("*", { count: "exact", head: true });
    out.scc_snapshots = snapErr ? { error: snapErr.message, code: snapErr.code } : { count: snapCount };
    console.log("[Debug] scc_snapshots count:", out.scc_snapshots);

    // 4. scc_crawl_jobs count
    const { count: jobCount, error: jobErr } = await (supabase as any)
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
