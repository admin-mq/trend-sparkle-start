-- ── Recurring Scans + Score History + Alerts ─────────────────────────────────

-- Add scheduling columns to projects
alter table public.pr_projects
  add column if not exists scan_frequency text default 'weekly'
    check (scan_frequency in ('daily', 'weekly', 'monthly', 'manual')),
  add column if not exists next_scan_at timestamptz;

-- ── Score history snapshots ───────────────────────────────────────────────────
-- One row inserted after every completed scan job
create table if not exists public.pr_score_history (
  id                    uuid        primary key default gen_random_uuid(),
  project_id            uuid        references public.pr_projects(id) on delete cascade not null,
  scan_job_id           uuid        references public.pr_scan_jobs(id) on delete set null,
  narrative_score       integer,
  authority_score       integer,
  proof_density_score   integer,
  risk_score            integer,
  opportunity_score     integer,
  pages_analyzed        integer,
  snapshot_date         timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

alter table public.pr_score_history enable row level security;

create policy "Users can access own score history"
  on public.pr_score_history for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create index if not exists pr_score_history_project_date
  on public.pr_score_history (project_id, snapshot_date desc);

-- ── Alerts ────────────────────────────────────────────────────────────────────
create table if not exists public.pr_alerts (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        references public.pr_projects(id) on delete cascade not null,
  scan_job_id     uuid        references public.pr_scan_jobs(id) on delete set null,
  alert_type      text        not null,
  -- score_drop | score_gain | risk_increase | risk_decrease | visibility_drop | visibility_gain | first_scan
  severity        text        not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low', 'positive')),
  title           text        not null,
  description     text,
  metric_name     text,         -- e.g. 'authority_score'
  metric_label    text,         -- e.g. 'Authority'
  previous_value  integer,
  current_value   integer,
  delta_value     integer,      -- current_value - previous_value
  read_at         timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.pr_alerts enable row level security;

create policy "Users can access own alerts"
  on public.pr_alerts for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create index if not exists pr_alerts_project_created
  on public.pr_alerts (project_id, created_at desc);
