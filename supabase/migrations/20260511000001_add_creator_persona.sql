alter table public.user_profiles
  add column if not exists creator_persona jsonb default null;
