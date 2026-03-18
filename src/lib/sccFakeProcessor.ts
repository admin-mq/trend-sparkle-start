import { supabase } from "@/lib/supabaseClient";

export type SccQueuedScanResult = {
  snapshotId: string;
  crawlJobId: string;
};

type StartQueuedSeoScanParams = {
  siteId: string;
  seedUrl: string;
  mode?: string;
  maxPages?: number;
  maxDepth?: number;
};

type EnsureCrawlJobParams = {
  siteId: string;
  snapshotId: string;
  seedUrl: string;
  maxPages?: number;
  maxDepth?: number;
};

function normalizeSeedUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) throw new Error("Seed URL is required");

  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";

    // Remove trailing slash except for root
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    throw new Error("Please enter a valid website URL");
  }
}

async function createSnapshot(siteId: string, mode = "seo_intelligence") {
  const now = new Date().toISOString();

  const { data, error } = await (supabase as any)
    .from("scc_snapshots")
    .insert({
      site_id: siteId,
      mode,
      status: "queued",
      progress_step: "queued",
      error_stage: null,
      error_message: null,
      started_at: now,
      finished_at: null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create SEO snapshot");
  }

  return data.id as string;
}

async function getExistingCrawlJobForSnapshot(snapshotId: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from("scc_crawl_jobs")
    .select("id,status,created_at")
    .eq("snapshot_id", snapshotId)
    .in("status", ["queued", "running", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to check existing crawl job");
  }

  return data?.id ?? null;
}

async function markSnapshotQueued(snapshotId: string) {
  const { error } = await (supabase as any)
    .from("scc_snapshots")
    .update({
      status: "queued",
      progress_step: "discovering",
      error_stage: null,
      error_message: null,
      finished_at: null,
    })
    .eq("id", snapshotId);

  if (error) {
    throw new Error(error.message || "Failed to update snapshot status");
  }
}

async function ensureCrawlJob(params: EnsureCrawlJobParams) {
  const { siteId, snapshotId, seedUrl, maxPages = 8, maxDepth = 1 } = params;

  const normalizedSeedUrl = normalizeSeedUrl(seedUrl);

  const existingJobId = await getExistingCrawlJobForSnapshot(snapshotId);
  if (existingJobId) {
    console.log("EXISTING SEO CRAWL JOB FOUND", {
      snapshotId,
      crawlJobId: existingJobId,
    });

    await markSnapshotQueued(snapshotId);

    return existingJobId;
  }

  console.log("QUEUEING SEO CRAWL JOB", {
    siteId,
    snapshotId,
    seedUrl: normalizedSeedUrl,
    maxPages,
    maxDepth,
  });

  const { data, error } = await (supabase as any)
    .from("scc_crawl_jobs")
    .insert({
      site_id: siteId,
      snapshot_id: snapshotId,
      seed_url: normalizedSeedUrl,
      status: "queued",
      max_pages: maxPages,
      max_depth: maxDepth,
      worker_id: null,
      heartbeat_at: null,
      started_at: null,
      completed_at: null,
      error_message: null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to queue crawl job");
  }

  await markSnapshotQueued(snapshotId);

  return data.id as string;
}

/**
 * Main real SEO scan flow.
 * Creates a snapshot, then queues a crawl job for the worker.
 */
export async function startQueuedSeoScan({
  siteId,
  seedUrl,
  mode = "seo_intelligence",
  maxPages = 8,
  maxDepth = 1,
}: StartQueuedSeoScanParams): Promise<SccQueuedScanResult> {
  if (!siteId) throw new Error("siteId is required");

  const normalizedSeedUrl = normalizeSeedUrl(seedUrl);

  const snapshotId = await createSnapshot(siteId, mode);

  const crawlJobId = await ensureCrawlJob({
    siteId,
    snapshotId,
    seedUrl: normalizedSeedUrl,
    maxPages,
    maxDepth,
  });

  return {
    snapshotId,
    crawlJobId,
  };
}

/**
 * Legacy compatibility export used by old UI code.
 *
 * IMPORTANT:
 * This no longer runs the fake client-side processor.
 * Instead, it queues a REAL crawl job against an existing snapshot
 * so older pages can still work while the frontend is being migrated.
 */
export async function runFakeProcessor(
  snapshotId: string,
  siteId: string,
  siteUrl: string,
): Promise<{ success: boolean; error?: string; crawlJobId?: string }> {
  try {
    if (!snapshotId) throw new Error("snapshotId is required");
    if (!siteId) throw new Error("siteId is required");
    if (!siteUrl) throw new Error("siteUrl is required");

    const crawlJobId = await ensureCrawlJob({
      siteId,
      snapshotId,
      seedUrl: siteUrl,
      maxPages: 8,
      maxDepth: 1,
    });

    return {
      success: true,
      crawlJobId,
    };
  } catch (err: any) {
    console.error("runFakeProcessor queue error:", err);
    return {
      success: false,
      error: err?.message || "Failed to queue crawl job",
    };
  }
}

/**
 * Compatibility export matching the object-based signature.
 */
export async function runSccFakeProcessor(params: StartQueuedSeoScanParams): Promise<SccQueuedScanResult> {
  return startQueuedSeoScan(params);
}

/**
 * Helper if parts of the app only need to queue a crawl job
 * against an already-created snapshot.
 */
export async function queueCrawlJobForSnapshot(params: {
  siteId: string;
  snapshotId: string;
  seedUrl: string;
  maxPages?: number;
  maxDepth?: number;
}): Promise<{ crawlJobId: string }> {
  const crawlJobId = await ensureCrawlJob(params);
  return { crawlJobId };
}
