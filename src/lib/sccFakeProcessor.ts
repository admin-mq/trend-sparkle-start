import { supabase } from "@/lib/supabaseClient";

const STAGE_DELAY = 2000; // 2 seconds per stage

const PROGRESS_STAGES = ["discovering", "analyzing", "calculating", "finalizing"] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateProgressStep(snapshotId: string, step: string) {
  const { error } = await (supabase as any)
    .from("scc_snapshots")
    .update({ progress_step: step })
    .eq("id", snapshotId);
  if (error) throw new Error(`Failed to update progress to ${step}: ${error.message}`);
}

async function failSnapshot(snapshotId: string, message: string) {
  await (supabase as any)
    .from("scc_snapshots")
    .update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", snapshotId);
}

export async function runFakeProcessor(
  snapshotId: string,
  siteId: string,
  siteUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Stage 1-3: progress updates with delays
    for (let i = 0; i < PROGRESS_STAGES.length - 1; i++) {
      await updateProgressStep(snapshotId, PROGRESS_STAGES[i]);
      await delay(STAGE_DELAY);
    }
    await updateProgressStep(snapshotId, "finalizing");

    // Insert mock pages
    const pages = [
      { site_id: siteId, url: siteUrl.replace(/\/$/, "") + "/", page_type: "home" },
      { site_id: siteId, url: siteUrl.replace(/\/$/, "") + "/collections/bestsellers", page_type: "category" },
      { site_id: siteId, url: siteUrl.replace(/\/$/, "") + "/products/sample-product", page_type: "product" },
    ];

    const { data: pageRows, error: pagesErr } = await (supabase as any)
      .from("scc_pages")
      .upsert(pages, { onConflict: "site_id,url" })
      .select("id, page_type");

    if (pagesErr) throw new Error(`Failed to insert pages: ${pagesErr.message}`);

    const pageMap: Record<string, string> = {};
    for (const p of pageRows) {
      pageMap[p.page_type] = p.id;
    }

    // Insert page snapshot metrics
    const metrics = [
      {
        snapshot_id: snapshotId,
        page_id: pageMap["home"],
        indexable: true,
        has_title: true,
        has_meta: true,
        has_h1: true,
        canonical_ok: true,
        internal_link_depth: 0,
        impressions: 5200,
        clicks: 310,
        avg_position: 3.2,
        ctr: 0.06,
        structural_score: 88,
        visibility_score: 82,
        revenue_score: 75,
        paid_risk_score: 10,
        page_opportunity_score: 60,
        priority_bucket: "medium",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["category"],
        indexable: true,
        has_title: true,
        has_meta: false,
        has_h1: true,
        canonical_ok: false,
        internal_link_depth: 2,
        impressions: 2800,
        clicks: 95,
        avg_position: 6.7,
        ctr: 0.034,
        structural_score: 55,
        visibility_score: 48,
        revenue_score: 65,
        paid_risk_score: 35,
        page_opportunity_score: 72,
        priority_bucket: "high",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["product"],
        indexable: true,
        has_title: true,
        has_meta: false,
        has_h1: true,
        canonical_ok: true,
        internal_link_depth: 3,
        impressions: 1200,
        clicks: 18,
        avg_position: 9.4,
        ctr: 0.015,
        structural_score: 62,
        visibility_score: 58,
        revenue_score: 70,
        paid_risk_score: 20,
        page_opportunity_score: 76,
        priority_bucket: "high",
      },
    ];

    const { error: metricsErr } = await (supabase as any)
      .from("scc_page_snapshot_metrics")
      .insert(metrics);

    if (metricsErr) throw new Error(`Failed to insert metrics: ${metricsErr.message}`);

    // Insert 5 action cards
    const actions = [
      {
        snapshot_id: snapshotId,
        page_id: pageMap["product"],
        action_type: "ctr_opportunity",
        title: "Increase CTR for page-1 listing",
        why_it_matters: "More clicks without needing a rank jump",
        technical_reason: "(Title/meta misaligned with intent; CTR below expected curve)",
        expected_impact_range: "+15-30% CTR",
        steps: ["Rewrite title tag to match searcher intent", "Add compelling meta description with CTA", "Test with A/B title variations"],
        severity: "high",
        priority: "high",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["product"],
        action_type: "schema_addition",
        title: "Add Product schema markup",
        why_it_matters: "Rich results increase visibility and click-through rates",
        technical_reason: "(Missing schema reduces rich result eligibility)",
        expected_impact_range: "+10-25% CTR",
        steps: ["Add JSON-LD Product schema", "Include price, availability, and review data", "Validate with Google Rich Results Test"],
        severity: "high",
        priority: "high",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["category"],
        action_type: "meta_optimization",
        title: "Fix missing meta descriptions on money pages",
        why_it_matters: "Search engines generate random snippets without meta descriptions",
        technical_reason: "(No meta description detected; snippets become random)",
        expected_impact_range: "+5-15% CTR",
        steps: ["Audit all category pages for missing meta descriptions", "Write unique, keyword-rich descriptions under 160 chars", "Deploy and monitor snippet changes in GSC"],
        severity: "medium",
        priority: "medium",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["category"],
        action_type: "canonical_fix",
        title: "Canonical consistency check",
        why_it_matters: "Canonical mismatches can split ranking signals between pages",
        technical_reason: "(Canonical mismatch can split ranking signals)",
        expected_impact_range: "+5-10% rankings stability",
        steps: ["Audit canonical tags across category pages", "Fix self-referencing canonical issues", "Remove conflicting canonical declarations"],
        severity: "medium",
        priority: "medium",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: null,
        action_type: "internal_linking",
        title: "Improve internal linking depth",
        why_it_matters: "Deep pages receive less crawl equity and rank lower",
        technical_reason: "(Deep pages receive less crawl equity)",
        expected_impact_range: "+10-20% crawl efficiency",
        steps: ["Map current link depth for all key pages", "Add contextual internal links from high-authority pages", "Create hub pages for orphaned content"],
        severity: "low",
        priority: "low",
        status: "pending",
      },
    ];

    const { error: actionsErr } = await (supabase as any)
      .from("scc_actions")
      .insert(actions);

    if (actionsErr) throw new Error(`Failed to insert actions: ${actionsErr.message}`);

    // Insert 5 mock queries
    const queries = [
      { site_id: siteId, query_text: "custom t shirt printing london", query_category: "money", intent_type: "transactional" },
      { site_id: siteId, query_text: "same day t shirt printing", query_category: "money", intent_type: "transactional" },
      { site_id: siteId, query_text: "bulk t shirt printing uk", query_category: "money", intent_type: "transactional" },
      { site_id: siteId, query_text: "t shirt printing near me", query_category: "local", intent_type: "local" },
      { site_id: siteId, query_text: "personalised t shirts london", query_category: "money", intent_type: "transactional" },
    ];

    const { data: queryRows, error: queriesErr } = await (supabase as any)
      .from("scc_queries")
      .upsert(queries, { onConflict: "site_id,query_text" })
      .select("id, query_text");

    if (queriesErr) throw new Error(`Failed to insert queries: ${queriesErr.message}`);

    const queryMap: Record<string, string> = {};
    for (const q of queryRows) {
      queryMap[q.query_text] = q.id;
    }

    // Insert query snapshot metrics
    const queryMetrics = [
      {
        snapshot_id: snapshotId,
        query_id: queryMap["custom t shirt printing london"],
        impressions: 3200, clicks: 40, avg_position: 8.6, ctr: 0.012,
        visibility_score: 60, opportunity_score: 82, priority_bucket: "high",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["same day t shirt printing"],
        impressions: 1800, clicks: 55, avg_position: 5.3, ctr: 0.031,
        visibility_score: 72, opportunity_score: 78, priority_bucket: "high",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["bulk t shirt printing uk"],
        impressions: 2400, clicks: 30, avg_position: 11.2, ctr: 0.013,
        visibility_score: 45, opportunity_score: 65, priority_bucket: "medium",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["t shirt printing near me"],
        impressions: 4100, clicks: 120, avg_position: 4.1, ctr: 0.029,
        visibility_score: 68, opportunity_score: 55, priority_bucket: "medium",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["personalised t shirts london"],
        impressions: 900, clicks: 8, avg_position: 18.4, ctr: 0.009,
        visibility_score: 30, opportunity_score: 40, priority_bucket: "low",
      },
    ];

    const { error: qMetricsErr } = await (supabase as any)
      .from("scc_query_snapshot_metrics")
      .insert(queryMetrics);

    if (qMetricsErr) throw new Error(`Failed to insert query metrics: ${qMetricsErr.message}`);

    // Mark snapshot as success
    await delay(500);
    const { error: successErr } = await (supabase as any)
      .from("scc_snapshots")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        progress_step: "done",
      })
      .eq("id", snapshotId);

    if (successErr) throw new Error(`Failed to mark snapshot success: ${successErr.message}`);

    return { success: true };
  } catch (err: any) {
    console.error("Fake processor error:", err);
    await failSnapshot(snapshotId, err.message || "Unknown processor error");
    return { success: false, error: err.message };
  }
}
