-- pr_scan_cache — idempotency cache for the pr-scan edge function.
-- Within a 24h window, pr-scan reuses the cached narrative_result_id instead
-- of re-running the crawl + LLM synthesis (~$0.55 per scan). Pass force=true
-- in the edge function body to bypass.

CREATE TABLE IF NOT EXISTS public.pr_scan_cache (
  project_id uuid NOT NULL REFERENCES public.pr_projects(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  narrative_result_id uuid NOT NULL REFERENCES public.pr_narrative_results(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_pr_scan_cache_created_at ON public.pr_scan_cache (created_at DESC);

-- Cache is server-managed only; edge functions use the service role which bypasses RLS.
-- No user-facing policies needed (and we don't want users to be able to read other
-- projects' cache entries or invalidate them).
ALTER TABLE public.pr_scan_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pr_scan_cache IS 'Idempotency cache for pr-scan. Keyed by (project_id, input_hash). Within a 24h window, pr-scan reuses the cached narrative_result_id instead of re-running the crawl + LLM synthesis. Pass force=true to bypass.';
