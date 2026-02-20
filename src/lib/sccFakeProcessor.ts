import { supabase } from "@/lib/supabaseClient";

const STAGE_DELAY = 2000;
const PROGRESS_STAGES = ["discovering", "analyzing", "calculating", "finalizing"] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const normalize = (q?: string) => q?.trim().replace(/\s+/g, " ").toLowerCase();

async function updateProgressStep(snapshotId: string, step: string) {
  const { error } = await (supabase as any).from("scc_snapshots").update({ progress_step: step }).eq("id", snapshotId);
  if (error) throw new Error(error.message);
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
  siteUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // progress simulation
    for (let i = 0; i < PROGRESS_STAGES.length - 1; i++) {
      await updateProgressStep(snapshotId, PROGRESS_STAGES[i]);
      await delay(STAGE_DELAY);
    }
    await updateProgressStep(snapshotId, "finalizing");

    /* ---------------- PAGES ---------------- */

    const pages = [
      { site_id: siteId, url: siteUrl.replace(/\/$/, "") + "/", page_type: "home" },
      { site_id: siteId, url: siteUrl.replace(/\/$/, "") + "/collections/bestsellers", page_type: "category" },
      { site_id: siteId, url: siteUrl.replace(/\/$/, "") + "/products/sample-product", page_type: "product" },
    ];

    const { data: pageRows, error: pagesErr } = await (supabase as any)
      .from("scc_pages")
      .upsert(pages, { onConflict: "site_id,url" })
      .select("id, page_type");

    if (pagesErr) throw new Error(pagesErr.message);

    const pageMap: Record<string, string> = {};
    pageRows.forEach((p: any) => (pageMap[p.page_type] = p.id));

    /* ---------------- PAGE METRICS ---------------- */

    const metrics = [
      {
        snapshot_id: snapshotId,
        page_id: pageMap.home,
        impressions: 5200,
        clicks: 310,
        avg_position: 3.2,
        ctr: 0.06,
        structural_score: 88,
        visibility_score: 82,
        page_opportunity_score: 60,
        priority_bucket: "medium",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap.category,
        impressions: 2800,
        clicks: 95,
        avg_position: 6.7,
        ctr: 0.034,
        structural_score: 55,
        visibility_score: 48,
        page_opportunity_score: 72,
        priority_bucket: "high",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap.product,
        impressions: 1200,
        clicks: 18,
        avg_position: 9.4,
        ctr: 0.015,
        structural_score: 62,
        visibility_score: 58,
        page_opportunity_score: 76,
        priority_bucket: "high",
      },
    ];

    const { error: metricsErr } = await (supabase as any).from("scc_page_snapshot_metrics").insert(metrics);

    if (metricsErr) throw new Error(metricsErr.message);

    /* ---------------- QUERIES ---------------- */

    const rawQueries = [
      {
        site_id: siteId,
        query_text: "custom t shirt printing london",
        query_category: "money",
        intent_type: "transactional",
      },
      {
        site_id: siteId,
        query_text: "same day t shirt printing",
        query_category: "money",
        intent_type: "transactional",
      },
      {
        site_id: siteId,
        query_text: "bulk t shirt printing uk",
        query_category: "money",
        intent_type: "transactional",
      },
      { site_id: siteId, query_text: "t shirt printing near me", query_category: "local", intent_type: "local" },
      {
        site_id: siteId,
        query_text: "personalised t shirts london",
        query_category: "money",
        intent_type: "transactional",
      },
    ];

    const queries = rawQueries.map((q) => ({
      ...q,
      query_text: normalize(q.query_text),
    }));

    const { data: queryRows, error: queriesErr } = await (supabase as any)
      .from("scc_queries")
      .upsert(queries, { onConflict: "site_id,query_text" })
      .select("id, query_text");

    if (queriesErr) throw new Error(queriesErr.message);

    const queryMap: Record<string, string> = {};
    queryRows.forEach((q: any) => (queryMap[q.query_text] = q.id));

    /* ---------------- QUERY METRICS ---------------- */

    const queryMetrics = [
      {
        snapshot_id: snapshotId,
        query_id: queryMap["custom t shirt printing london"],
        impressions: 3200,
        clicks: 40,
        avg_position: 8.6,
        ctr: 0.012,
        visibility_score: 60,
        query_opportunity_score: 82,
        priority_bucket: "high",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["same day t shirt printing"],
        impressions: 1800,
        clicks: 55,
        avg_position: 5.3,
        ctr: 0.031,
        visibility_score: 72,
        query_opportunity_score: 78,
        priority_bucket: "high",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["bulk t shirt printing uk"],
        impressions: 2400,
        clicks: 30,
        avg_position: 11.2,
        ctr: 0.013,
        visibility_score: 45,
        query_opportunity_score: 65,
        priority_bucket: "medium",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["t shirt printing near me"],
        impressions: 4100,
        clicks: 120,
        avg_position: 4.1,
        ctr: 0.029,
        visibility_score: 68,
        query_opportunity_score: 55,
        priority_bucket: "medium",
      },
      {
        snapshot_id: snapshotId,
        query_id: queryMap["personalised t shirts london"],
        impressions: 900,
        clicks: 8,
        avg_position: 18.4,
        ctr: 0.009,
        visibility_score: 30,
        query_opportunity_score: 40,
        priority_bucket: "low",
      },
    ];

    const { error: qMetricsErr } = await (supabase as any).from("scc_query_snapshot_metrics").insert(queryMetrics);

    if (qMetricsErr) throw new Error(qMetricsErr.message);

    /* ---------------- SUCCESS ---------------- */

    await (supabase as any)
      .from("scc_snapshots")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        progress_step: "done",
      })
      .eq("id", snapshotId);

    return { success: true };
  } catch (err: any) {
    await failSnapshot(snapshotId, err.message);
    return { success: false, error: err.message };
  }
}
