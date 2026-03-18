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
  const { data, error } = await supabase
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

  const { data, error } = await supabase
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
 * Compatibility export in case the UI is still calling the old function name.
 * This now uses the real queued worker flow.
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
