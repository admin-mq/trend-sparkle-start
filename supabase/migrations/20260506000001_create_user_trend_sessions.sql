-- user_trend_sessions: stores the 25-trend candidate pool per (user, brand?) so
-- "Refresh Trends" can reshuffle within a 2-hour cooldown window without
-- re-running the (expensive) full fetch pipeline.
--
-- Lifecycle:
--   1. User clicks "Generate Trend Recommendations" → fetch-trends populates
--      candidate_pool (jsonb array of 25 trend rows), recommend-trends picks
--      6–7, records served_trend_ids, sets fetched_at = now().
--   2. User clicks "Refresh Trends" within 2h of fetched_at → recommend-trends
--      reshuffles from candidate_pool, picks a NEW 6–7 (preferring trends not
--      yet in served_trend_ids), appends to served_trend_ids, returns flag
--      `cooldown_active=true` so the UI shows the "too soon" popup.
--   3. After 2h → fetch-trends runs fresh, replaces candidate_pool, resets
--      served_trend_ids.
--
-- One row per (user_id, brand_id) — null brand_id allowed for creator-only
-- profiles. Upsert on conflict.

CREATE TABLE IF NOT EXISTS public.user_trend_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE,

  -- Inputs that defined the pool — if any change, treat as a new session.
  location TEXT NOT NULL,                     -- ISO-ish: 'GB','US','CA','AU','NZ','IN'
  primary_category_id INT NOT NULL,           -- Google Trends category id (1–6)
  niche TEXT,                                 -- raw niche/industry string for trace

  -- The 25-trend candidate pool. Stored as a jsonb array of trend rows
  -- (trend_id, trend_name, virality_score, category, regions, signals, etc.).
  -- We snapshot the pool here so reshuffles are deterministic and don't
  -- re-query the trends table (which may have shifted).
  candidate_pool JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- trend_ids we've already shown the user this session. On reshuffle we
  -- prefer un-served trends, falling back to "less relevant" ones with the
  -- "too soon" popup.
  served_trend_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- The most recent recommendation set returned to the UI (so reload doesn't
  -- re-run the LLM either). Array of {trend_id, why_good_fit, hook, ...}.
  last_recommendations JSONB,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refresh_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refresh_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active session per (user, brand). Null brand_id collides with null
  -- using a partial unique index (PG treats NULL as distinct in regular
  -- unique constraints).
  CONSTRAINT user_trend_sessions_user_brand_unique UNIQUE (user_id, brand_id)
);

-- Hot-path index: looking up "do we have an active session for this user/brand?"
CREATE INDEX IF NOT EXISTS idx_user_trend_sessions_lookup
  ON public.user_trend_sessions (user_id, brand_id, fetched_at DESC);

-- Cleanup index: occasionally prune sessions older than ~7 days.
CREATE INDEX IF NOT EXISTS idx_user_trend_sessions_fetched_at
  ON public.user_trend_sessions (fetched_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_user_trend_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_trend_sessions_updated_at ON public.user_trend_sessions;
CREATE TRIGGER user_trend_sessions_updated_at
  BEFORE UPDATE ON public.user_trend_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_user_trend_sessions_updated_at();

-- RLS: users see only their own sessions.
ALTER TABLE public.user_trend_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_trend_sessions_select_own
  ON public.user_trend_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_trend_sessions_insert_own
  ON public.user_trend_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_trend_sessions_update_own
  ON public.user_trend_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_trend_sessions_delete_own
  ON public.user_trend_sessions FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_trend_sessions IS
  'Per-(user,brand) 25-trend candidate pool with 2h cooldown for Refresh Trends.';
COMMENT ON COLUMN public.user_trend_sessions.candidate_pool IS
  'Snapshot of 25 candidate trends. Reshuffles read from here without re-fetching.';
COMMENT ON COLUMN public.user_trend_sessions.served_trend_ids IS
  'trend_ids already shown this session; reshuffle prefers un-served first.';
