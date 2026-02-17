
-- 1. scc_sites
create table public.scc_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_url text not null,
  cms_detected text,
  industry text,
  country text,
  created_at timestamptz default now()
);

alter table public.scc_sites enable row level security;

create policy "Users can manage their own sites"
on public.scc_sites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 2. scc_snapshots
create table public.scc_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.scc_sites(id) on delete cascade,
  status text not null,
  mode text not null,
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table public.scc_snapshots enable row level security;

create policy "Users can access snapshots of their sites"
on public.scc_snapshots for all
using (
  exists (select 1 from public.scc_sites where scc_sites.id = scc_snapshots.site_id and scc_sites.user_id = auth.uid())
)
with check (
  exists (select 1 from public.scc_sites where scc_sites.id = scc_snapshots.site_id and scc_sites.user_id = auth.uid())
);

-- 3. scc_pages
create table public.scc_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.scc_sites(id) on delete cascade,
  url text not null,
  page_type text,
  first_seen_at timestamptz,
  last_seen_at timestamptz
);

alter table public.scc_pages enable row level security;

create policy "Users can access pages of their sites"
on public.scc_pages for all
using (
  exists (select 1 from public.scc_sites where scc_sites.id = scc_pages.site_id and scc_sites.user_id = auth.uid())
)
with check (
  exists (select 1 from public.scc_sites where scc_sites.id = scc_pages.site_id and scc_sites.user_id = auth.uid())
);

-- 4. scc_page_snapshot_metrics
create table public.scc_page_snapshot_metrics (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.scc_snapshots(id) on delete cascade,
  page_id uuid not null references public.scc_pages(id) on delete cascade,
  indexable boolean,
  canonical_ok boolean,
  has_title boolean,
  has_meta boolean,
  has_h1 boolean,
  schema_types jsonb,
  internal_link_depth integer,
  impressions integer,
  clicks integer,
  avg_position numeric,
  ctr numeric,
  sessions integer,
  conversions integer,
  revenue numeric,
  paid_cost numeric,
  paid_clicks integer,
  paid_conversions integer,
  paid_revenue numeric,
  structural_score integer,
  visibility_score integer,
  revenue_score integer,
  paid_risk_score integer,
  page_opportunity_score integer,
  priority_bucket text,
  created_at timestamptz default now()
);

alter table public.scc_page_snapshot_metrics enable row level security;

create policy "Users can access page metrics of their sites"
on public.scc_page_snapshot_metrics for all
using (
  exists (
    select 1 from public.scc_snapshots s
    join public.scc_sites st on st.id = s.site_id
    where s.id = scc_page_snapshot_metrics.snapshot_id and st.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.scc_snapshots s
    join public.scc_sites st on st.id = s.site_id
    where s.id = scc_page_snapshot_metrics.snapshot_id and st.user_id = auth.uid()
  )
);

-- 5. scc_queries
create table public.scc_queries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.scc_sites(id) on delete cascade,
  query_text text not null,
  query_category text,
  intent_type text,
  first_seen_at timestamptz,
  last_seen_at timestamptz
);

alter table public.scc_queries enable row level security;

create policy "Users can access queries of their sites"
on public.scc_queries for all
using (
  exists (select 1 from public.scc_sites where scc_sites.id = scc_queries.site_id and scc_sites.user_id = auth.uid())
)
with check (
  exists (select 1 from public.scc_sites where scc_sites.id = scc_queries.site_id and scc_sites.user_id = auth.uid())
);

-- 6. scc_query_snapshot_metrics
create table public.scc_query_snapshot_metrics (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.scc_snapshots(id) on delete cascade,
  query_id uuid not null references public.scc_queries(id) on delete cascade,
  impressions integer,
  clicks integer,
  avg_position numeric,
  ctr numeric,
  visibility_score integer,
  opportunity_score integer,
  priority_bucket text,
  created_at timestamptz default now()
);

alter table public.scc_query_snapshot_metrics enable row level security;

create policy "Users can access query metrics of their sites"
on public.scc_query_snapshot_metrics for all
using (
  exists (
    select 1 from public.scc_snapshots s
    join public.scc_sites st on st.id = s.site_id
    where s.id = scc_query_snapshot_metrics.snapshot_id and st.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.scc_snapshots s
    join public.scc_sites st on st.id = s.site_id
    where s.id = scc_query_snapshot_metrics.snapshot_id and st.user_id = auth.uid()
  )
);

-- 7. scc_actions
create table public.scc_actions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.scc_snapshots(id) on delete cascade,
  page_id uuid references public.scc_pages(id) on delete set null,
  query_id uuid references public.scc_queries(id) on delete set null,
  action_type text not null,
  description text,
  priority text,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table public.scc_actions enable row level security;

create policy "Users can access actions of their sites"
on public.scc_actions for all
using (
  exists (
    select 1 from public.scc_snapshots s
    join public.scc_sites st on st.id = s.site_id
    where s.id = scc_actions.snapshot_id and st.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.scc_snapshots s
    join public.scc_sites st on st.id = s.site_id
    where s.id = scc_actions.snapshot_id and st.user_id = auth.uid()
  )
);
