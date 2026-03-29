import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * pr-scheduler — called by a daily cron job.
 *
 * Finds all projects whose next_scan_at is due (or overdue) and whose
 * scan_frequency is not 'manual', then fires a pr-scan job for each.
 *
 * Safety limits: max 10 projects per run to avoid edge function timeout.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Allow GET (for cron) or POST (for manual trigger)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date().toISOString();

    // Find projects that are due for a rescan
    const { data: dueProjects, error: queryErr } = await supabase
      .from("pr_projects")
      .select("id, brand_name, domain, scan_frequency, next_scan_at")
      .neq("scan_frequency", "manual")
      .not("next_scan_at", "is", null)
      .lte("next_scan_at", now)
      .limit(10);

    if (queryErr) throw new Error(`Query failed: ${queryErr.message}`);
    if (!dueProjects || dueProjects.length === 0) {
      console.log("[pr-scheduler] No projects due for rescan.");
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pr-scheduler] ${dueProjects.length} project(s) due for rescan.`);

    const triggered: string[] = [];

    for (const project of dueProjects) {
      try {
        // Create a scan job
        const { data: job, error: jobErr } = await supabase
          .from("pr_scan_jobs")
          .insert({
            project_id: project.id,
            status: "queued",
            progress_step: "Scheduled rescan queued",
          })
          .select("id")
          .single();

        if (jobErr || !job) {
          console.error(`[pr-scheduler] Failed to create job for ${project.id}:`, jobErr);
          continue;
        }

        // Fire pr-scan (fire and forget per project)
        fetch(`${SUPABASE_URL}/functions/v1/pr-scan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ project_id: project.id, scan_job_id: job.id }),
        }).catch((e) =>
          console.error(`[pr-scheduler] Failed to fire pr-scan for ${project.id}:`, e)
        );

        triggered.push(project.id);
        console.log(`[pr-scheduler] Triggered scan for ${project.brand_name} (${project.domain})`);
      } catch (projectErr) {
        console.error(`[pr-scheduler] Error processing project ${project.id}:`, projectErr);
      }
    }

    return new Response(
      JSON.stringify({ triggered: triggered.length, project_ids: triggered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[pr-scheduler] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
