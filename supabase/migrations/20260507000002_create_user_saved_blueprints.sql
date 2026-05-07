-- user_saved_blueprints: every Execution Blueprint the user reaches in
-- Trend Quest gets auto-saved here, surfaced on the "My Drafts" page.
--
-- UX contract:
--   • When `setDetailedDirection(blueprint)` fires in TrendQuest.tsx
--     after a successful generate-blueprint call, the result lands
--     here automatically (no explicit save button needed).
--   • Surfaced on /tweet-drafts (sidebar "My Drafts"). Despite the
--     legacy URL, that page is being repurposed to show blueprints —
--     they ARE the user's drafts. Tweet drafts (the old purpose)
--     remain available via a secondary tab on the same page.
--   • No TTL — blueprints are real work product. User explicitly
--     deletes via the trash button.
--
-- One row per (user, brand, trend, direction_title) — re-running
-- generate-blueprint for the same direction overwrites (UPSERT) so
-- the user always sees the latest version, not a pile of revisions.

CREATE TABLE IF NOT EXISTS public.user_saved_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  brand_name TEXT,

  -- The trend this blueprint was generated FOR. Same caveat as
  -- user_saved_trends: no FK to trends — they can age out.
  trend_id TEXT NOT NULL,
  trend_name TEXT NOT NULL,
  trend_category TEXT,
  region TEXT,
  trend_hashtags TEXT,

  -- The CreativeDirection that produced this blueprint.
  direction_title TEXT NOT NULL,
  direction_summary TEXT,

  -- The full DetailedDirection object — script, beats, hooks,
  -- captions, content_format, etc. Schema lives in TS land
  -- (src/types/trends.ts → DetailedDirection); we store as
  -- jsonb so future schema changes don't break old rows.
  blueprint JSONB NOT NULL,

  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One row per direction within a (user, brand, trend). Re-generating
  -- the same direction's blueprint overwrites instead of stacking.
  CONSTRAINT user_saved_blueprints_unique UNIQUE (user_id, brand_id, trend_id, direction_title)
);

-- Hot-path index: "show me my drafts, newest first" on the My Drafts page.
CREATE INDEX IF NOT EXISTS idx_user_saved_blueprints_recent
  ON public.user_saved_blueprints (user_id, created_at DESC);

-- Filter by brand on the My Drafts page.
CREATE INDEX IF NOT EXISTS idx_user_saved_blueprints_brand
  ON public.user_saved_blueprints (user_id, brand_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_user_saved_blueprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_saved_blueprints_updated_at ON public.user_saved_blueprints;
CREATE TRIGGER user_saved_blueprints_updated_at
  BEFORE UPDATE ON public.user_saved_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_user_saved_blueprints_updated_at();

-- RLS: users see only their own.
ALTER TABLE public.user_saved_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_saved_blueprints_select_own
  ON public.user_saved_blueprints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_saved_blueprints_insert_own
  ON public.user_saved_blueprints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_saved_blueprints_update_own
  ON public.user_saved_blueprints FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_saved_blueprints_delete_own
  ON public.user_saved_blueprints FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_saved_blueprints IS
  'Auto-saved Execution Blueprints from Trend Quest. Surfaced on the My Drafts page.';
COMMENT ON COLUMN public.user_saved_blueprints.blueprint IS
  'Full DetailedDirection JSON (script, beats, hooks, captions, etc.).';
