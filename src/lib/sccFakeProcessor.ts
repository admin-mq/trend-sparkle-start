import { supabase } from "@/integrations/supabase/client";

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

function normalizeSeedUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) throw new Error("Seed URL is required");

  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";

    // remove trailing slash except root
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    throw new Error("Please enter a valid website URL");
  }
}

async function createSnapshot(siteId: string, mode = "seo_intelligence") {
  const { data, error } = await (supabase as any)
    .from("scc_snapshots")
    .insert({
      site_id: siteId,
      mode,
      status: "queued",
      progress_step: "queued",
      error_stage: null,
      error_message: null,
      finished_at: null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create SEO snapshot");
  }

  return data.id as string;
}

async function ensureCrawlJob(params: {
  siteId: string;
  snapshotId: string;
  seedUrl: string;
  maxPages?: number;
  maxDepth?: number;
}) {
  const { siteId, snapshotId, seedUrl, maxPages = 8, maxDepth = 1 } = params;

  const normalizedSeedUrl = normalizeSeedUrl(seedUrl);

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
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to queue crawl job");
  }

  return data.id as string;
}

/**
 * Main function for the current real SEO scan flow.
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
 * Legacy compatibility export used by SEO.tsx and SEOResults.tsx.
 * Accepts positional args (snapshotId, siteId, siteUrl) and runs the
 * fake/mock processor flow client-side. Returns { success, error }.
 */
export async function runFakeProcessor(
  _snapshotId: string,
  _siteId: string,
  _siteUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // The snapshot is already created by the caller; just mark it success
    // after a short simulated delay (the real worker handles actual crawling).
    const steps = ["discovering", "analyzing", "scoring", "generating_actions", "finalizing"];
    for (const step of steps) {
      await (supabase as any)
        .from("scc_snapshots")
        .update({ progress_step: step })
        .eq("id", _snapshotId);
      await new Promise((r) => setTimeout(r, 1500));
    }

    await (supabase as any)
      .from("scc_snapshots")
      .update({ status: "success", progress_step: "done", finished_at: new Date().toISOString() })
      .eq("id", _snapshotId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Scan processing failed" };
  }
}

/**
 * Compatibility export matching the object-based signature.
 */
export async function runSccFakeProcessor(params: {
  siteId: string;
  seedUrl: string;
  mode?: string;
  maxPages?: number;
  maxDepth?: number;
}): Promise<SccQueuedScanResult> {
  return startQueuedSeoScan(params);
}

/**
 * Optional helper if parts of the app only need to queue a crawl job
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
