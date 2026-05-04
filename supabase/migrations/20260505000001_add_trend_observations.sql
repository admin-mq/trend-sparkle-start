-- Tier 3 / Fix #1 — Trend evolution timeline (observation time-series).
--
-- Today the `trends` table stores ONE row per trend with a single
-- snapshot of its current signal state (virality_score, corroboration,
-- yt_view_count, etc). Every fetch-trends run overwrites those numbers.
-- That gives us "what's hot now" but loses the entire history of how a
-- trend got there.
--
-- This migration adds a time-series companion table: one row per
-- (trend_id, observation moment), capturing the signal state at that
-- point in time. Lets us:
--   1. Render real sparklines ("47K → 312K views over 2 days")
--   2. Eventually forecast decay HONESTLY (the est_decay_at we
--      deliberately deferred in the lifecycle migration). We said:
--      "we'll add it once we have 3+ weeks of history". This table
--      *is* that history.
--   3. Detect zombie trends — a trend that flatlined for 5 days, then
--      suddenly spikes is interesting in a way the current schema
--      can't express.
--
-- Static fields (trend_name, description, hashtags, region, category,
-- first_seen_at, last_seen_at) STAY on `trends` — they don't vary per
-- observation. Only the *signal* fields are snapshotted here. If a
-- trend's category shifts (rare), we'd update `trends`, not duplicate
-- the row in observations.

CREATE TABLE IF NOT EXISTS public.trend_observations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id            TEXT NOT NULL REFERENCES public.trends(trend_id) ON DELETE CASCADE,
  observed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Time-varying signal snapshot. Same names as the corresponding
  -- columns on `trends` for ease of joining. NULL is meaningful and
  -- preserved — never zero-fill.
  virality_score      INT,
  corroboration_score INT,
  source_signals      TEXT[],
  timing              TEXT,
  ig_validated        TEXT,

  -- Real YouTube engagement at this point in time. NULL = no qualifying
  -- match was found at this observation (same contract as the parent
  -- trends.yt_* columns — never fabricated).
  yt_view_count       BIGINT,
  yt_like_count       BIGINT,
  yt_comment_count    BIGINT
);

-- Primary lookup: "give me the last N observations for trend X".
-- DESC observed_at lets recent-first pagination be cheap.
CREATE INDEX IF NOT EXISTS trend_observations_trend_id_observed_at_idx
  ON public.trend_observations (trend_id, observed_at DESC);

-- Helpful for time-window queries across all trends ("show me everything
-- observed in the last 24h").
CREATE INDEX IF NOT EXISTS trend_observations_observed_at_idx
  ON public.trend_observations (observed_at DESC);

-- ── Backfill ───────────────────────────────────────────────────────────
--
-- For each existing trend, write ONE synthetic observation as of its
-- last_seen_at. Honesty rule: we don't have older history (we never
-- captured it), so the sparkline for any trend that's only been
-- observed once will simply be a single point — and the UI is built
-- to NOT render a sparkline for fewer than 2 observations.
--
-- We pick last_seen_at (not date_added or NOW()) because that's the
-- timestamp that most accurately reflects when these signal values
-- were measured. date_added is just the calendar date the row landed.
INSERT INTO public.trend_observations (
  trend_id,
  observed_at,
  virality_score,
  corroboration_score,
  source_signals,
  timing,
  ig_validated,
  yt_view_count,
  yt_like_count,
  yt_comment_count
)
SELECT
  trend_id,
  COALESCE(last_seen_at, NOW()),
  virality_score,
  corroboration_score,
  source_signals,
  timing,
  ig_validated,
  yt_view_count,
  yt_like_count,
  yt_comment_count
FROM public.trends
WHERE NOT EXISTS (
  -- Idempotent: only insert if this trend has zero observations yet.
  -- Re-running the migration won't duplicate the synthetic backfill row.
  SELECT 1 FROM public.trend_observations o WHERE o.trend_id = public.trends.trend_id
);

COMMENT ON TABLE public.trend_observations IS
  'Time-series of signal snapshots per trend. One row per fetch-trends run per active trend. Powers sparklines and (eventually) decay forecasting.';
COMMENT ON COLUMN public.trend_observations.observed_at IS
  'When fetch-trends captured this signal snapshot. Indexed DESC for cheap "most recent N" queries.';
COMMENT ON COLUMN public.trend_observations.virality_score IS
  'Snapshot of virality_score at observed_at. Compare across rows to draw a real evolution curve — never extrapolate beyond the latest observation.';
