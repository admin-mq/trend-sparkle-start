-- Add competitors JSONB column to brand_profiles so the Profile page
-- can persist discovered/manual competitors and the PR flow can pre-fill them.
alter table brand_profiles
  add column if not exists competitors jsonb not null default '[]'::jsonb;
