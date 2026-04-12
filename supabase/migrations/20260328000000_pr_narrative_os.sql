-- PR / Narrative OS tables

-- ── Projects ─────────────────────────────────────────────────────────────────
create table if not exists public.pr_projects (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users(id) on delete cascade not null,
  brand_name       text        not null,
  domain           text        not null,
  industry         text,
  geography        text        default 'Global',
  target_audience  text,
  competitors      jsonb       not null default '[]',
  tracked_prompts  jsonb       not null default '[]',
  created_at       timestamptz not null default now()
);

alter table public.pr_projects enable row level security;

create policy "Users own their PR projects"
  on public.pr_projects for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Scan jobs ─────────────────────────────────────────────────────────────────
create table if not exists public.pr_scan_jobs (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        references public.pr_projects(id) on delete cascade not null,
  status        text        not null default 'queued'
                            check (status in ('queued', 'running', 'completed', 'failed')),
  progress_step text,
  started_at    timestamptz,
  ended_at      timestamptz,
  error_message text,
  created_at    timestamptz not null default now()
);

alter table public.pr_scan_jobs enable row level security;

create policy "Users can access own PR scan jobs"
  on public.pr_scan_jobs for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- ── Narrative results ─────────────────────────────────────────────────────────
create table if not exists public.pr_narrative_results (
  id                    uuid        primary key default gen_random_uuid(),
  project_id            uuid        references public.pr_projects(id) on delete cascade not null,
  scan_job_id           uuid        references public.pr_scan_jobs(id) on delete cascade not null,
  narrative_score       integer,
  authority_score       integer,
  proof_density_score   integer,
  risk_score            integer,
  opportunity_score     integer,
  brand_narratives      jsonb       default '[]',
  competitor_narratives jsonb       default '{}',
  proof_gaps            jsonb       default '[]',
  recommended_actions   jsonb       default '[]',
  executive_summary     text,
  pages_analyzed        integer     default 0,
  created_at            timestamptz not null default now()
);

alter table public.pr_narrative_results enable row level security;

create policy "Users can access own PR results"
  on public.pr_narrative_results for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
