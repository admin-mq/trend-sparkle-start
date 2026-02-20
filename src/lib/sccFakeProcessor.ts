import { supabase } from "@/lib/supabaseClient";

const STAGE_DELAY = 1200; // faster feedback
const PROGRESS_STAGES = ["discovering", "analyzing", "calculating", "finalizing"] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ProgressStep = (typeof PROGRESS_STAGES)[number] | "done";

async function updateSnapshot(snapshotId: string, patch: Record<string, any>) {
  const { error } = await (supabase as any).from("scc_snapshots").update(patch).eq("id", snapshotId);
  if (error) throw new Error(error.message);
}

async function updateProgressStep(snapshotId: string, step: ProgressStep) {
  await updateSnapshot(snapshotId, { progress_step: step });
}

async function failSnapshot(snapshotId: string, stage: string, message: string) {
  // Some schemas have error_stage; some don’t. Try with it, fallback without.
  const base = {
    status: "failed",
    error_message: message,
    finished_at: new Date().toISOString(),
    progress_step: "done",
  };

  const attempt1 = await (supabase as any)
    .from("scc_snapshots")
    .update({ ...base, error_stage: stage })
    .eq("id", snapshotId);

  if (attempt1?.error) {
    await (supabase as any).from("scc_snapshots").update(base).eq("id", snapshotId);
  }
}

function normalizeQueryText(q?: string) {
  return (q ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeUrl(url: string) {
  const u = (url || "").trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

async function safeDelete(table: string, where: Record<string, any>) {
  let q = (supabase as any).from(table).delete();
  for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw new Error(`Failed to cleanup ${table}: ${error.message}`);
}

export async function runFakeProcessor(
  snapshotId: string,
  siteId: string,
  siteUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ---- Progress simulation ----
    for (const step of PROGRESS_STAGES) {
      await updateProgressStep(snapshotId, step);
      await delay(STAGE_DELAY);
    }

    const baseUrl = normalizeUrl(siteUrl);

    // ---- Cleanup so reruns don’t duplicate ----
    // (If RLS blocks deletes, you'll see a clean error instead of “success but empty UI”.)
    await safeDelete("scc_actions", { snapshot_id: snapshotId });
    await safeDelete("scc_page_snapshot_metrics", { snapshot_id: snapshotId });
    await safeDelete("scc_query_snapshot_metrics", { snapshot_id: snapshotId });

    // ---- Pages (upsert) ----
    const pages = [
      { site_id: siteId, url: `${baseUrl}/`, page_type: "home" },
      { site_id: siteId, url: `${baseUrl}/collections/bestsellers`, page_type: "category" },
      { site_id: siteId, url: `${baseUrl}/products/sample-product`, page_type: "product" },
    ];

    const { data: pageRows, error: pagesErr } = await (supabase as any)
      .from("scc_pages")
      .upsert(pages, { onConflict: "site_id,url", ignoreDuplicates: false })
      .select("id,page_type");

    if (pagesErr) throw new Error(`Failed to upsert pages: ${pagesErr.message}`);
    if (!pageRows || pageRows.length < 3) throw new Error(`Pages upsert returned ${pageRows?.length ?? 0} rows`);

    const pageMap: Record<string, string> = {};
    for (const p of pageRows) pageMap[p.page_type] = p.id;

    // ---- Page snapshot metrics ----
    // Prefer upsert if you have a unique index on (snapshot_id,page_id). If not, insert works after cleanup.
    const pageMetrics = [
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

    const { error: pageMetricsErr } = await (supabase as any).from("scc_page_snapshot_metrics").insert(pageMetrics);

    if (pageMetricsErr) throw new Error(`Failed to insert page metrics: ${pageMetricsErr.message}`);

    // ---- Action cards (this drives “Recommended Actions” UI) ----
    // Your scc_actions columns (from your CSV) include:
    // action_type (NOT NULL), snapshot_id (NOT NULL), plus optional: title, why_it_matters, technical_reason, expected_impact_range, steps(jsonb), severity, priority, status, summary, page_id, query_id
    const actions = [
      {
        snapshot_id: snapshotId,
        page_id: pageMap["product"],
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
        summary: "Quick CTR win by aligning title/meta with intent.",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["product"],
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
        summary: "Schema improves rich result eligibility.",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["category"],
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
        summary: "Meta descriptions control SERP messaging.",
      },
      {
        snapshot_id: snapshotId,
        page_id: pageMap["category"],
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
        summary: "Canonical hygiene stabilizes rankings.",
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
        summary: "Better internal linking helps crawl + rankings.",
      },
    ];

    const { error: actionsErr } = await (supabase as any).from("scc_actions").insert(actions);
    if (actionsErr) throw new Error(`Failed to insert actions: ${actionsErr.message}`);

    // ---- Queries (upsert) ----
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

    const queries = rawQueries
      .filter((q) => q?.query_text)
      .map((q) => ({ ...q, query_text: normalizeQueryText(q.query_text) }));

    const { data: queryRows, error: queriesErr } = await (supabase as any)
      .from("scc_queries")
      .upsert(queries, { onConflict: "site_id,query_text", ignoreDuplicates: false })
      .select("id,query_text");

    if (queriesErr) throw new Error(`Failed to upsert queries: ${queriesErr.message}`);
    if (!queryRows || queryRows.length < queries.length) {
      throw new Error(`Query upsert returned ${queryRows?.length ?? 0} rows, expected >= ${queries.length}`);
    }

    const queryMap: Record<string, string> = {};
    for (const q of queryRows) queryMap[q.query_text] = q.id;

    // ---- Query snapshot metrics ----
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

    for (const qm of queryMetrics) {
      if (!qm.query_id) throw new Error("Missing query_id mapping in queryMetrics");
    }

    const { error: qMetricsErr } = await (supabase as any).from("scc_query_snapshot_metrics").insert(queryMetrics);

    if (qMetricsErr) throw new Error(`Failed to insert query metrics: ${qMetricsErr.message}`);

    // ---- Mark snapshot as success ----
    await delay(300);
    await updateSnapshot(snapshotId, {
      status: "success",
      finished_at: new Date().toISOString(),
      progress_step: "done",
      error_message: null,
    });

    return { success: true };
  } catch (err: any) {
    console.error("Fake processor error:", err);
    await failSnapshot(snapshotId, "fake_processor", err?.message || "Unknown processor error");
    return { success: false, error: err?.message };
  }
}
