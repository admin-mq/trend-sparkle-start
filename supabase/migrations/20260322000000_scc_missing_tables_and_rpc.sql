-- ============================================================
-- SEQ Crawler: missing tables, columns, constraints, and RPC
-- ============================================================

-- 1. Add missing columns to scc_snapshots
ALTER TABLE public.scc_snapshots
  ADD COLUMN IF NOT EXISTS progress_step text,
  ADD COLUMN IF NOT EXISTS error_stage text,
  ADD COLUMN IF NOT EXISTS error_message text;

-- 2. Add missing columns to scc_actions
ALTER TABLE public.scc_actions
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS why_it_matters text,
  ADD COLUMN IF NOT EXISTS technical_reason text,
  ADD COLUMN IF NOT EXISTS expected_impact_range text,
  ADD COLUMN IF NOT EXISTS steps text[],
  ADD COLUMN IF NOT EXISTS severity text;

-- 3. Unique constraint on scc_pages so we can upsert by (site_id, url)
ALTER TABLE public.scc_pages
  DROP CONSTRAINT IF EXISTS scc_pages_site_id_url_unique;
ALTER TABLE public.scc_pages
  ADD CONSTRAINT scc_pages_site_id_url_unique UNIQUE (site_id, url);

-- 4. Unique constraint on scc_page_snapshot_metrics for upsert by (snapshot_id, page_id)
ALTER TABLE public.scc_page_snapshot_metrics
  DROP CONSTRAINT IF EXISTS scc_psm_snapshot_page_unique;
ALTER TABLE public.scc_page_snapshot_metrics
  ADD CONSTRAINT scc_psm_snapshot_page_unique UNIQUE (snapshot_id, page_id);

-- 5. scc_crawl_jobs table
CREATE TABLE IF NOT EXISTS public.scc_crawl_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid        NOT NULL REFERENCES public.scc_sites(id) ON DELETE CASCADE,
  snapshot_id       uuid        NOT NULL REFERENCES public.scc_snapshots(id) ON DELETE CASCADE,
  seed_url          text        NOT NULL,
  status            text        NOT NULL DEFAULT 'queued',
  max_pages         integer     NOT NULL DEFAULT 8,
  max_depth         integer     NOT NULL DEFAULT 1,
  crawl_delay_ms    integer     DEFAULT 0,
  respect_robots    boolean     DEFAULT false,
  render_js         boolean     DEFAULT false,
  worker_id         text,
  claimed_at        timestamptz,
  heartbeat_at      timestamptz,
  pages_done        integer     DEFAULT 0,
  errors_count      integer     DEFAULT 0,
  error_message     text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.scc_crawl_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access crawl jobs of their sites"
ON public.scc_crawl_jobs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.scc_sites
    WHERE scc_sites.id = scc_crawl_jobs.site_id
      AND scc_sites.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scc_sites
    WHERE scc_sites.id = scc_crawl_jobs.site_id
      AND scc_sites.user_id = auth.uid()
  )
);

-- Index for worker polling (find next queued job fast)
CREATE INDEX IF NOT EXISTS idx_scc_crawl_jobs_status_created
  ON public.scc_crawl_jobs (status, created_at ASC);

-- 6. scc_page_snapshot_crawl table (raw crawl data per page per scan)
CREATE TABLE IF NOT EXISTS public.scc_page_snapshot_crawl (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id           uuid        NOT NULL REFERENCES public.scc_snapshots(id) ON DELETE CASCADE,
  page_id               uuid        NOT NULL REFERENCES public.scc_pages(id) ON DELETE CASCADE,
  url                   text,
  final_url             text,
  status_code           integer,
  content_type          text,
  load_ms               integer,
  title                 text,
  meta_description      text,
  canonical_url         text,
  h1_count              integer,
  h1_text               text,
  word_count            integer,
  robots_meta           text,
  noindex               boolean,
  indexable             boolean,
  internal_links_count  integer,
  internal_link_depth   integer,
  page_type             text,
  fetch_error           text,
  created_at            timestamptz DEFAULT now(),
  CONSTRAINT scc_psc_snapshot_page_unique UNIQUE (snapshot_id, page_id)
);

ALTER TABLE public.scc_page_snapshot_crawl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access page crawl data of their sites"
ON public.scc_page_snapshot_crawl FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.scc_snapshots s
    JOIN public.scc_sites st ON st.id = s.site_id
    WHERE s.id = scc_page_snapshot_crawl.snapshot_id
      AND st.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scc_snapshots s
    JOIN public.scc_sites st ON st.id = s.site_id
    WHERE s.id = scc_page_snapshot_crawl.snapshot_id
      AND st.user_id = auth.uid()
  )
);

-- ============================================================
-- RPC functions used by the Railway crawler worker
-- ============================================================

-- Drop existing versions first to allow return type changes
DROP FUNCTION IF EXISTS public.scc_claim_next_job(text);
DROP FUNCTION IF EXISTS public.scc_rescue_stale_jobs(integer);
DROP FUNCTION IF EXISTS public.scc_job_heartbeat(uuid);
DROP FUNCTION IF EXISTS public.scc_complete_crawl_job(uuid, text, text);

-- Claim the next queued job (atomic, skip-locked)
CREATE OR REPLACE FUNCTION public.scc_claim_next_job(p_worker_id text)
RETURNS SETOF public.scc_crawl_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job public.scc_crawl_jobs;
BEGIN
  SELECT * INTO v_job
  FROM public.scc_crawl_jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.scc_crawl_jobs
  SET
    status       = 'running',
    worker_id    = p_worker_id,
    claimed_at   = now(),
    heartbeat_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN NEXT v_job;
END;
$$;

-- Rescue stale jobs whose workers have gone silent
CREATE OR REPLACE FUNCTION public.scc_rescue_stale_jobs(p_minutes integer DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.scc_crawl_jobs
  SET
    status       = 'queued',
    worker_id    = NULL,
    claimed_at   = NULL
  WHERE
    status       = 'running'
    AND heartbeat_at < now() - (p_minutes || ' minutes')::interval;
END;
$$;

-- Heartbeat: keep a running job alive
CREATE OR REPLACE FUNCTION public.scc_job_heartbeat(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.scc_crawl_jobs
  SET heartbeat_at = now()
  WHERE id = p_job_id;
END;
$$;

-- Mark a job as completed or failed
CREATE OR REPLACE FUNCTION public.scc_complete_crawl_job(
  p_job_id uuid,
  p_status  text,
  p_error   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.scc_crawl_jobs
  SET
    status        = p_status,
    error_message = p_error
  WHERE id = p_job_id;
END;
$$;
