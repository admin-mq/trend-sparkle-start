import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Scoring metadata ───────────────────────────────────────────────────────────

const SCORE_META: Record<string, { label: string; higherIsBetter: boolean }> = {
  narrative_score:     { label: "Narrative",     higherIsBetter: true  },
  authority_score:     { label: "Authority",      higherIsBetter: true  },
  proof_density_score: { label: "Proof Density",  higherIsBetter: true  },
  risk_score:          { label: "Risk",           higherIsBetter: false },
  opportunity_score:   { label: "Opportunity",    higherIsBetter: true  },
};

// ── Thresholds ────────────────────────────────────────────────────────────────

function classifyDelta(
  metricKey: string,
  delta: number
): { isSignificant: boolean; severity: string; isPositive: boolean } | null {
  const meta = SCORE_META[metricKey];
  if (!meta) return null;

  const absDelta = Math.abs(delta);
  if (absDelta < 3) return null; // noise — skip

  // For "higher is better" metrics:
  //   positive delta = good; negative delta = bad
  // For "lower is better" (risk):
  //   positive delta = bad (risk went up); negative delta = good
  const isGoodChange = meta.higherIsBetter ? delta > 0 : delta < 0;

  let severity: string;
  if (absDelta >= 20) severity = isGoodChange ? "positive" : "critical";
  else if (absDelta >= 10) severity = isGoodChange ? "positive" : "high";
  else if (absDelta >= 5) severity = isGoodChange ? "positive" : "medium";
  else severity = isGoodChange ? "positive" : "low";

  return { isSignificant: true, severity, isPositive: isGoodChange };
}

function buildAlertTitle(
  metricKey: string,
  delta: number,
  prev: number,
  curr: number
): string {
  const meta = SCORE_META[metricKey];
  const absDelta = Math.abs(delta);
  const isGoodChange = meta.higherIsBetter ? delta > 0 : delta < 0;
  const direction = isGoodChange ? "improved" : "dropped";
  return `${meta.label} score ${direction} by ${absDelta} points (${prev} → ${curr})`;
}

function buildAlertDescription(
  metricKey: string,
  delta: number,
  isPositive: boolean
): string {
  const meta = SCORE_META[metricKey];
  const absDelta = Math.abs(delta);

  const descMap: Record<string, { good: string; bad: string }> = {
    narrative_score: {
      good: `Your brand narrative is becoming stronger and more consistent. Keep reinforcing your core positioning.`,
      bad: `Your brand narrative has weakened. Review recent content for mixed messaging or diluted positioning.`,
    },
    authority_score: {
      good: `Your authority signals are growing. Third-party mentions, press, or credibility content is having an impact.`,
      bad: `Your authority has dipped by ${absDelta} points. Consider publishing thought leadership content or seeking press coverage.`,
    },
    proof_density_score: {
      good: `More concrete proof is backing your claims — case studies, testimonials, or data are strengthening your position.`,
      bad: `Evidence backing your claims has weakened. Prioritise adding case studies, stats, or testimonials.`,
    },
    risk_score: {
      good: `Your narrative risk has reduced. Weak claims or competitor threats are diminishing.`,
      bad: `Your risk exposure has increased by ${absDelta} points. Review competitor activity and any weakening claims.`,
    },
    opportunity_score: {
      good: `New PR and content opportunities have been identified in your latest scan.`,
      bad: `Opportunity score shifted. This may reflect changes in the competitive landscape.`,
    },
  };

  return descMap[metricKey]?.[isPositive ? "good" : "bad"] ?? "";
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { project_id, scan_job_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    // Load the two most recent snapshots
    const { data: snapshots, error: snapErr } = await supabase
      .from("pr_score_history")
      .select("*")
      .eq("project_id", project_id)
      .order("snapshot_date", { ascending: false })
      .limit(2);

    if (snapErr) throw new Error(`Failed to load snapshots: ${snapErr.message}`);

    // First scan ever — no deltas to compare, just emit a welcome alert
    if (!snapshots || snapshots.length === 0) {
      return new Response(JSON.stringify({ alerts_created: 0, reason: "no snapshots" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (snapshots.length === 1) {
      await supabase.from("pr_alerts").insert({
        project_id,
        scan_job_id: scan_job_id || null,
        alert_type: "first_scan",
        severity: "positive",
        title: "First scan complete — your baseline is set",
        description:
          "Your initial narrative intelligence scan is done. Future scans will compare against this baseline and surface changes automatically.",
        metric_name: null,
        metric_label: null,
        previous_value: null,
        current_value: null,
        delta_value: null,
      });
      return new Response(JSON.stringify({ alerts_created: 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const current = snapshots[0];
    const previous = snapshots[1];

    const alertsToInsert: any[] = [];

    for (const metricKey of Object.keys(SCORE_META)) {
      const curr: number | null = current[metricKey];
      const prev: number | null = previous[metricKey];
      if (curr == null || prev == null) continue;

      const delta = curr - prev;
      const classification = classifyDelta(metricKey, delta);
      if (!classification) continue;

      alertsToInsert.push({
        project_id,
        scan_job_id: scan_job_id || null,
        alert_type: classification.isPositive ? "score_gain" : "score_drop",
        severity: classification.severity,
        title: buildAlertTitle(metricKey, delta, prev, curr),
        description: buildAlertDescription(metricKey, delta, classification.isPositive),
        metric_name: metricKey,
        metric_label: SCORE_META[metricKey].label,
        previous_value: prev,
        current_value: curr,
        delta_value: delta,
      });
    }

    if (alertsToInsert.length > 0) {
      const { error: alertErr } = await supabase.from("pr_alerts").insert(alertsToInsert);
      if (alertErr) throw new Error(`Failed to insert alerts: ${alertErr.message}`);
    }

    console.log(`[pr-alert-evaluator] project=${project_id} alerts_created=${alertsToInsert.length}`);

    return new Response(
      JSON.stringify({ alerts_created: alertsToInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[pr-alert-evaluator] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
