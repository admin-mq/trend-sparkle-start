import { supabase } from "@/lib/supabaseClient";

const POLL_EVERY_MS = 2000;
const MAX_WAIT_MS = 4 * 60 * 1000; // 4 minutes

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(url: string) {
  if (typeof url !== "string") throw new Error("Invalid URL");

  let raw = url.trim();
  if (!raw) throw new Error("URL is required");

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  const u = new URL(raw);
  u.hash = "";

  ["gclid", "fbclid"].forEach((p) => u.searchParams.delete(p));
  [...u.searchParams.keys()].forEach((k) => {
    if (k.toLowerCase().startsWith("utm_")) u.searchParams.delete(k);
  });

  u.hostname = u.hostname.toLowerCase();

  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}

async function updateSnapshot(snapshotId: string, patch: Record<string, any>) {
  const { error } = await (supabase as any).from("scc_snapshots").update(patch).eq("id", snapshotId);

  if (error) throw new Error(error.message);
}

async function failSnapshot(snapshotId: string, stage: string, message: string) {
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

async function getSnapshot(snapshotId: string) {
  const { data, error } = await (supabase as any)
    .from("scc_snapshots")
    .select("id,status,progress_step,error_message,finished_at")
    .eq("id", snapshotId)
    .single();

  if (error) throw new Error(`Failed to fetch snapshot: ${error.message}`);
  return data;
}

async function ensureCrawlJob(snapshotId: string, siteId: string, seedUrl: string) {
  // If a job already exists for this snapshot and is still active, reuse it.
  const { data: existingJobs, error: existingError } = await (supabase as any)
    .from("scc_crawl_jobs")
    .select("id,status,snapshot_id")
    .eq("snapshot_id", snapshotId)
    .in("status", ["queued", "running", "completed"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingError) {
    throw new Error(`Failed checking existing crawl job: ${existingError.message}`);
  }

  const existing = existingJobs?.[0];
  if (existing) return existing;

  const { data: crawlJob, error: crawlJobError } = await (supabase as any)
    .from("scc_crawl_jobs")
    .insert({
      site_id: siteId,
      snapshot_id: snapshotId,
      seed_url: seedUrl,
      status: "queued",
    })
    .select("id,status,snapshot_id")
    .single();

  if (crawlJobError) {
    throw new Error(`Failed to create crawl job: ${crawlJobError.message}`);
  }

  return crawlJob;
}

async function waitForSnapshotCompletion(snapshotId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const snapshot = await getSnapshot(snapshotId);

    if (snapshot.status === "success") {
      return { success: true as const };
    }

    if (snapshot.status === "failed") {
      return {
        success: false as const,
        error: snapshot.error_message || "Snapshot failed",
      };
    }

    await delay(POLL_EVERY_MS);
  }

  return {
    success: false as const,
    error: "Timed out waiting for crawl job to finish",
  };
}

export async function runFakeProcessor(
  snapshotId: string,
  siteId: string,
  siteUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedUrl = normalizeUrl(siteUrl);

    // Reset snapshot into queued state before handing off to worker
    await updateSnapshot(snapshotId, {
      status: "queued",
      progress_step: "queued",
      finished_at: null,
      error_message: null,
    });

    // Create the queued crawl job that Railway worker will pick up
    await ensureCrawlJob(snapshotId, siteId, normalizedUrl);

    // Wait for worker to complete the snapshot
    const result = await waitForSnapshotCompletion(snapshotId);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("SEO crawl enqueue error:", err);
    await failSnapshot(snapshotId, "crawl_enqueue", err?.message || "Unknown enqueue error");
    return { success: false, error: err?.message };
  }
}
