-- PR Answer Visibility Engine tables

-- ── Visibility runs ───────────────────────────────────────────────────────────
create table if not exists public.pr_visibility_runs (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        references public.pr_projects(id) on delete cascade not null,
  status     text        not null default 'queued'
                         check (status in ('queued', 'running', 'completed', 'failed')),
  progress   integer     default 0,  -- prompts completed
  total      integer     default 0,  -- total prompts
  error      text,
  created_at timestamptz not null default now(),
  ended_at   timestamptz
);

alter table public.pr_visibility_runs enable row level security;

create policy "Users can access own visibility runs"
  on public.pr_visibility_runs for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- ── Per-prompt results ────────────────────────────────────────────────────────
create table if not exists public.pr_visibility_results (
  id                   uuid        primary key default gen_random_uuid(),
  run_id               uuid        references public.pr_visibility_runs(id) on delete cascade not null,
  project_id           uuid        references public.pr_projects(id) on delete cascade not null,
  prompt_text          text        not null,
  geography            text,
  brand_present        boolean,
  brand_position       integer,     -- 1-5 if mentioned (1 = prominent), null if absent
  brand_context        text,        -- how brand was mentioned
  competitor_presence  jsonb        default '{}',  -- { "domain.com": true/false }
  cited_domains        jsonb        default '[]',  -- ["domain1.com", ...]
  raw_answer           text,
  why_absent           text,        -- if brand not present
  analysis_summary     text,
  visibility_score     integer,     -- 0-100
  created_at           timestamptz  not null default now()
);

alter table public.pr_visibility_results enable row level security;

create policy "Users can access own visibility results"
  on public.pr_visibility_results for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
