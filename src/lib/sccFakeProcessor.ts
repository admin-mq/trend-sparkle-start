import { supabase } from "@/lib/supabaseClient";

const STAGE_DELAY = 1200; // feel free to tweak
const PROGRESS_STAGES = ["discovering", "analyzing", "calculating", "finalizing"] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const normalize = (s?: string | null) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

async function updateProgressStep(snapshotId: string, step: string) {
  const { error } = await (supabase as any).from("scc_snapshots").update({ progress_step: step }).eq("id", snapshotId);

  if (error) throw new Error(`Failed to update progress to ${step}: ${error.message}`);
}

async function markSnapshotFailed(snapshotId: string, message: string) {
  // Never throw from failure handler—best effort only
  await (supabase as any)
    .from("scc_snapshots")
    .update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
      progress_step: "failed",
    })
    .eq("id", snapshotId);
}

async function markSnapshotSuccess(snapshotId: string) {
  const { error } = await (supabase as any)
    .from("scc_snapshots")
    .update({
      status: "success",
      finished_at: new Date().toISOString(),
      progress_step: "done",
    })
    .eq("id", snapshotId);

  if (error) throw new Error(`Failed to mark snapshot success: ${error.message}`);
}

function requireId(id: any, label: string) {
  if (!id || typeof id !== "string") throw new Error(`Missing ${label} id`);
  return id;
}

export async function runFakeProcessor(
  snapshotId: string,
  siteId: string,
  siteUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    requireId(snapshotId, "snapshot");
    requireId(siteId, "site");

    const baseUrl = siteUrl.replace(/\/$/, "");
    const homeUrl = `${baseUrl}/`;
    const categoryUrl = `${baseUrl}/collections/bestsellers`;
    const productUrl = `${baseUrl}/products/sample-product`;

    // Progress simulation
    for (let i = 0; i < PROGRESS_STAGES.length; i++) {
      await updateProgressStep(snapshotId, PROGRESS_STAGES[i]);
      await delay(STAGE_DELAY);
    }

    // -------------------------
    // 1) UPSERT PAGES (idempotent)
    // -------------------------
    const pages = [
      { site_id: siteId, url: homeUrl, page_type: "home" },
      { site_id: siteId, url: categoryUrl, page_type: "category" },
      { site_id: siteId, url: productUrl, page_type: "product" },
    ];

    const { data: pageRows, error: pagesErr } = await (supabase as any)
      .from("scc_pages")
      .upsert(pages, { onConflict: "site_id,url" })
      .select("id, url, page_type");

    if (pagesErr) throw new Error(`Failed to upsert pages: ${pagesErr.message}`);
    if (!pageRows || pageRows.length < 3)
      throw new Error(`Pages upsert returned ${pageRows?.length ?? 0} rows, expected 3`);

    const pageMap: Record<string, string> = {};
    for (const p of pageRows) {
      if (p?.page_type && p?.id) pageMap[p.page_type] = p.id;
    }

    const homeId = requireId(pageMap["home"], "home page");
    const categoryId = requireId(pageMap["category"], "category page");
    const productId = requireId(pageMap["product"], "product page");

    // -----------------------------------------
    // 2) UPSERT PAGE SNAPSHOT METRICS (idempotent)
    // NOTE: requires UNIQUE(snapshot_id, page_id) to be perfect,
    // but upsert will still work if constraint exists. If not, it will error.
    // -----------------------------------------
    const pageMetrics = [
      {
        snapshot_id: snapshotId,
        page_id: homeId,
        indexable: true,
        canonical_ok: true,
        has_title: true,
        has_meta: true,
        has_h1: true,
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
        page_id: categoryId,
        indexable: true,
        canonical_ok: false,
        has_title: true,
        has_meta: false,
        has_h1: true,
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
        page_id: productId,
        indexable: true,
        canonical_ok: true,
        has_title: true,
        has_meta: false,
        has_h1: true,
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

    const { error: pageMetricsErr } = await (supabase as any)
      .from("scc_page_snapshot_metrics")
      .upsert(pageMetrics, { onConflict: "snapshot_id,page_id" });

    if (pageMetricsErr) {
      throw new Error(
        `Failed to upsert page snapshot metrics: ${pageMetricsErr.message} (Tip: ensure UNIQUE(snapshot_id,page_id) exists)`,
      );
    }

    // -------------------------
    // 3) INSERT/UPSERT ACTIONS (idempotent-ish)
    // We can’t safely upsert without a clear unique key. We’ll do:
    // - delete existing actions for snapshot (safe + simple)
    // - insert fresh set
    // -------------------------
    const { error: delActionsErr } = await (supabase as any).from("scc_actions").delete().eq("snapshot_id", snapshotId);

    if (delActionsErr) throw new Error(`Failed to clear existing actions: ${delActionsErr.message}`);

    const actions = [
      {
        snapshot_id: snapshotId,
        page_id: productId,
        query_id: null,
        action_type: "ctr_opportunity",
        title: "Increase CTR for page-1 listing",
        why_it_matters: "More clicks without needing a rank jump",
        technical_reason: "(Title/meta misaligned with intent; CTR below expected curve)",
        expected_impact_range: "+15-30% CTR",
        steps: [
          "Rewrite title tag to match searcher intent",
          "Add compelling meta description with CTA",
          "Test with A/B title variations",
        ],
        severity: "high",
        priority: "high",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: productId,
        query_id: null,
        action_type: "schema_addition",
        title: "Add Product schema markup",
        why_it_matters: "Rich results increase visibility and click-through rates",
        technical_reason: "(Missing schema reduces rich result eligibility)",
        expected_impact_range: "+10-25% CTR",
        steps: [
          "Add JSON-LD Product schema",
          "Include price, availability, and review data",
          "Validate with Google Rich Results Test",
        ],
        severity: "high",
        priority: "high",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: categoryId,
        query_id: null,
        action_type: "meta_optimization",
        title: "Fix missing meta descriptions on money pages",
        why_it_matters: "Search engines generate random snippets without meta descriptions",
        technical_reason: "(No meta description detected; snippets become random)",
        expected_impact_range: "+5-15% CTR",
        steps: [
          "Audit all category pages for missing meta descriptions",
          "Write unique, keyword-rich descriptions under 160 chars",
          "Deploy and monitor snippet changes in GSC",
        ],
        severity: "medium",
        priority: "medium",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: categoryId,
        query_id: null,
        action_type: "canonical_fix",
        title: "Canonical consistency check",
        why_it_matters: "Canonical mismatches can split ranking signals between pages",
        technical_reason: "(Canonical mismatch can split ranking signals)",
        expected_impact_range: "+5-10% rankings stability",
        steps: [
          "Audit canonical tags across category pages",
          "Fix self-referencing canonical issues",
          "Remove conflicting canonical declarations",
        ],
        severity: "medium",
        priority: "medium",
        status: "pending",
      },
      {
        snapshot_id: snapshotId,
        page_id: null,
        query_id: null,
        action_type: "internal_linking",
        title: "Improve internal linking depth",
        why_it_matters: "Deep pages receive less crawl equity and rank lower",
        technical_reason: "(Deep pages receive less crawl equity)",
        expected_impact_range: "+10-20% crawl efficiency",
        steps: [
          "Map current link depth for all key pages",
          "Add contextual internal links from high-authority pages",
          "Create hub pages for orphaned content",
        ],
        severity: "low",
        priority: "low",
        status: "pending",
      },
    ];

    const { error: actionsErr } = await (supabase as any).from("scc_actions").insert(actions);

    if (actionsErr) throw new Error(`Failed to insert actions: ${actionsErr.message}`);

    // -------------------------
    // 4) UPSERT QUERIES (idempotent)
    // -------------------------
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

    const normalizedQueries = rawQueries
      .map((q) => ({ ...q, query_text: normalize(q.query_text) }))
      .filter((q) => q.query_text.length > 0);

    // Deduplicate within this run
    const queries = Array.from(new Map(normalizedQueries.map((q) => [`${q.site_id}::${q.query_text}`, q])).values());

    const { data: queryRows, error: queriesErr } = await (supabase as any)
      .from("scc_queries")
      .upsert(queries, { onConflict: "site_id,query_text" })
      .select("id, query_text");

    if (queriesErr) throw new Error(`Failed to upsert queries: ${queriesErr.message}`);
    if (!queryRows || queryRows.length < 5) {
      throw new Error(`Query upsert returned only ${queryRows?.length ?? 0} rows, expected >= 5`);
    }

    const queryMap: Record<string, string> = {};
    for (const q of queryRows) queryMap[normalize(q.query_text)] = q.id;

    // -------------------------
    // 5) UPSERT QUERY SNAPSHOT METRICS (idempotent)
    // Requires UNIQUE(snapshot_id, query_id) which you already added.
    // -------------------------
    const queryMetrics = [
      {
        snapshot_id: snapshotId,
        query_id: queryMap[normalize("custom t shirt printing london")],
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
        query_id: queryMap[normalize("same day t shirt printing")],
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
        query_id: queryMap[normalize("bulk t shirt printing uk")],
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
        query_id: queryMap[normalize("t shirt printing near me")],
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
        query_id: queryMap[normalize("personalised t shirts london")],
        impressions: 900,
        clicks: 8,
        avg_position: 18.4,
        ctr: 0.009,
        visibility_score: 30,
        query_opportunity_score: 40,
        priority_bucket: "low",
      },
    ];

    for (const qm of queryMetrics) {
      if (!qm.query_id) throw new Error(`Missing query_id mapping for query metrics row`);
    }

    const { error: qMetricsErr } = await (supabase as any)
      .from("scc_query_snapshot_metrics")
      .upsert(queryMetrics, { onConflict: "snapshot_id,query_id" });

    if (qMetricsErr) throw new Error(`Failed to upsert query metrics: ${qMetricsErr.message}`);

    // Quick validation: ensure rows exist for this snapshot
    const { count: qmCount, error: qmCountErr } = await (supabase as any)
      .from("scc_query_snapshot_metrics")
      .select("id", { count: "exact", head: true })
      .eq("snapshot_id", snapshotId);

    if (qmCountErr) throw new Error(`Failed to validate query metrics count: ${qmCountErr.message}`);
    if ((qmCount ?? 0) < 5) throw new Error(`Query metrics validation failed: only ${qmCount} rows`);

    await delay(250);
    await markSnapshotSuccess(snapshotId);

    return { success: true };
  } catch (err: any) {
    console.error("Fake processor error:", err);
    await markSnapshotFailed(snapshotId, err?.message || "Unknown processor error");
    return { success: false, error: err?.message || "Unknown processor error" };
  }
}
