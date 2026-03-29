-- External Mentions Ingestion
-- Stores third-party URLs (press, reviews, roundups) fetched and AI-analysed
-- per project. These are incorporated into the main narrative scan synthesis.

create table if not exists public.pr_external_mentions (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        references public.pr_projects(id) on delete cascade not null,

  -- User-supplied fields
  url             text        not null,
  source_type     text        not null default 'article'
                              check (source_type in (
                                'article', 'review_site', 'roundup',
                                'competitor_review', 'social', 'other'
                              )),

  -- Processing status
  status          text        not null default 'pending'
                              check (status in (
                                'pending', 'fetching', 'analyzing', 'done', 'failed'
                              )),
  error_message   text,

  -- Fetched content
  page_title      text,
  fetched_text    text,       -- cleaned text, capped at 8000 chars

  -- AI analysis outputs
  sentiment       text        check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score integer,    -- 0-100 (100 = very positive)
  themes          jsonb       not null default '[]',        -- string[]
  proof_signals   jsonb       not null default '[]',        -- string[]
  key_quotes      jsonb       not null default '[]',        -- { quote: string, context: string }[]
  brand_mentions  jsonb       not null default '[]',        -- { brand: string, framing: string }[]
  ai_summary      text,

  analyzed_at     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.pr_external_mentions enable row level security;

create policy "Users can access own external mentions"
  on public.pr_external_mentions for all
  using (
    exists (
      select 1 from public.pr_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create index if not exists pr_external_mentions_project_status
  on public.pr_external_mentions (project_id, status);

create index if not exists pr_external_mentions_project_created
  on public.pr_external_mentions (project_id, created_at desc);
