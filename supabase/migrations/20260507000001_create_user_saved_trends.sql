-- user_saved_trends: stores "liked" / clicked trends for 48 hours.
--
-- UX contract:
--   • User clicks a trend card on Trend Quest → row inserted.
--   • Visible under the "My Trends" tab in the Trend Quest stepper.
--   • Auto-expires 48h after saved_at — read queries filter on
--     `expires_at > now()` so we don't have to run a delete cron
--     immediately. A nightly cleanup job CAN delete expired rows
--     for housekeeping but isn't required for correctness.
--   • Snapshot of the full trend row is stored in `trend_snapshot`
--     (jsonb) so the user sees what they saved even if the trends
--     table has since updated/expired.
--
-- One row per (user, brand, trend). Re-clicking the same trend
-- bumps `saved_at` and `expires_at` (UPSERT semantics) instead of
-- inserting a duplicate.

CREATE TABLE IF NOT EXISTS public.user_saved_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE,

  -- The trend row this save points at. We do NOT FK to trends —
  -- trends rows can become inactive/deleted, but the user still
  -- wants to see what they saved. trend_snapshot below preserves
  -- the visible record.
  trend_id TEXT NOT NULL,
  trend_name TEXT NOT NULL,
  trend_category TEXT,
  region TEXT,

  -- Full snapshot of the trend object as the recommend-trends
  -- response had it at save time (virality_score, why_good_fit,
  -- example_hook, source_signals, etc.). Renders the card in the
  -- My Trends tab without re-running recommend-trends.
  trend_snapshot JSONB NOT NULL,

  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 48h TTL. Stored explicitly so reads can filter on indexed
  -- column and a future cleanup cron can delete in batch.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),

  CONSTRAINT user_saved_trends_unique UNIQUE (user_id, brand_id, trend_id)
);

-- Hot-path index: "show me my saved trends, newest first".
-- (We can't use a partial WHERE expires_at > now() predicate — now() isn't
-- IMMUTABLE per Postgres rules. Filtering happens at query time.)
CREATE INDEX IF NOT EXISTS idx_user_saved_trends_active
  ON public.user_saved_trends (user_id, brand_id, expires_at DESC);

-- Cleanup index: prune expired rows.
CREATE INDEX IF NOT EXISTS idx_user_saved_trends_expires_at
  ON public.user_saved_trends (expires_at);

-- RLS: users see only their own saves.
ALTER TABLE public.user_saved_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_saved_trends_select_own
  ON public.user_saved_trends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_saved_trends_insert_own
  ON public.user_saved_trends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_saved_trends_update_own
  ON public.user_saved_trends FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_saved_trends_delete_own
  ON public.user_saved_trends FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_saved_trends IS
  '48h-TTL bookmarks of trends the user clicked in Trend Quest. Surfaced under the "My Trends" tab.';
COMMENT ON COLUMN public.user_saved_trends.trend_snapshot IS
  'Full snapshot of the recommend-trends response row, so the saved card renders even if upstream trends are gone.';
COMMENT ON COLUMN public.user_saved_trends.expires_at IS
  '48h after saved_at. Read paths must filter expires_at > now().';
