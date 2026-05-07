-- Ensure brand_profiles has user_id and competitors columns.
-- user_id was added to the live DB outside of tracked migrations;
-- competitors was added in 20260430000001 but may not have been applied.
-- Both use IF NOT EXISTS so this migration is safe to run multiple times.

alter table public.brand_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.brand_profiles
  add column if not exists competitors jsonb not null default '[]'::jsonb;

-- Index for fast per-user lookups (no-op if it already exists)
create index if not exists idx_brand_profiles_user_id on public.brand_profiles(user_id);

-- Replace the open "anyone" RLS policies with auth-scoped ones so that
-- each user can only see and modify their own brand profiles.
-- Drop old permissive policies first (IF EXISTS = safe no-op if already gone).
drop policy if exists "Anyone can view brand profiles"   on public.brand_profiles;
drop policy if exists "Anyone can create brand profiles" on public.brand_profiles;
drop policy if exists "Anyone can update brand profiles" on public.brand_profiles;
drop policy if exists "Anyone can delete brand profiles" on public.brand_profiles;

-- Re-create scoped policies only if they don't already exist.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'brand_profiles'
      and policyname = 'Users can view their own brand profiles'
  ) then
    execute $p$
      create policy "Users can view their own brand profiles"
      on public.brand_profiles for select
      using (auth.uid() = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'brand_profiles'
      and policyname = 'Users can create their own brand profiles'
  ) then
    execute $p$
      create policy "Users can create their own brand profiles"
      on public.brand_profiles for insert
      with check (auth.uid() = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'brand_profiles'
      and policyname = 'Users can update their own brand profiles'
  ) then
    execute $p$
      create policy "Users can update their own brand profiles"
      on public.brand_profiles for update
      using (auth.uid() = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'brand_profiles'
      and policyname = 'Users can delete their own brand profiles'
  ) then
    execute $p$
      create policy "Users can delete their own brand profiles"
      on public.brand_profiles for delete
      using (auth.uid() = user_id)
    $p$;
  end if;
end $$;

-- Enforce one brand per user at the DB level.
-- First, drop any duplicate rows (keep the most recently updated one per user).
delete from public.brand_profiles
where user_id is not null
  and id not in (
    select distinct on (user_id) id
    from public.brand_profiles
    where user_id is not null
    order by user_id, updated_at desc, id desc
  );

-- Then add the unique constraint (idempotent via DO block).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'brand_profiles_user_id_unique'
      and conrelid = 'public.brand_profiles'::regclass
  ) then
    alter table public.brand_profiles
      add constraint brand_profiles_user_id_unique unique (user_id);
  end if;
end $$;
