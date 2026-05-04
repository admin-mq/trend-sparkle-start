-- Tier 2 / Fix #7 — Lifecycle timestamps (honest version).
--
-- Today the timeline is binned into early/peaking/saturated. That's a
-- categorical shorthand for "how mature is this trend", but we never tell
-- the user *when* the trend actually broke or *when* it peaked. We just
-- have date_added (always today) and a fuzzy timing label.
--
-- This migration adds real observation history:
--
--   first_seen_at         — the very first time we saw this trend.
--                           Set on INSERT, NEVER overwritten on update.
--                           Powers "trend broke Xh ago" copy.
--   last_seen_at          — refreshed on every observation. Lets us tell
--                           users when the signal last appeared and surface
--                           "last seen 18h ago" if a trend goes quiet.
--   peaked_at             — stamped when current virality_score sets a new
--                           max for this trend_id. NULL until we observe
--                           a virality drop.
--   peak_virality_score   — the highest virality_score ever recorded for
--                           this trend. Drives "still climbing" vs
--                           "past peak" copy.
--
-- Forecast fields (est_decay_at, est_lifespan_hours) are deliberately NOT
-- added here. We don't have enough history per trend yet to forecast decay
-- honestly. Adding a model-derived guess now would repeat the
-- views_last_60h_millions mistake — a fabricated number labeled as data.
-- We'll add it in a follow-up once we have 3+ weeks of observation history
-- and can fit a real curve.

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS first_seen_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peaked_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peak_virality_score  INT;

-- Backfill: for existing rows we have no real observation history, so
-- the most honest backfill is "first/last seen = whenever the row was
-- created (date_added at midnight UTC)". peak_virality_score = current
-- virality_score (this is the only data point we have, so by definition
-- it's the peak). peaked_at stays NULL — we have no evidence the trend
-- has actually peaked yet, so don't claim it has.
UPDATE public.trends
   SET first_seen_at = COALESCE(first_seen_at,
                                (date_added::timestamp AT TIME ZONE 'UTC')),
       last_seen_at  = COALESCE(last_seen_at,
                                (date_added::timestamp AT TIME ZONE 'UTC')),
       peak_virality_score = COALESCE(peak_virality_score, virality_score)
 WHERE first_seen_at IS NULL
    OR last_seen_at  IS NULL
    OR peak_virality_score IS NULL;

-- Going forward, NOT NULL is enforced (after backfill).
ALTER TABLE public.trends
  ALTER COLUMN first_seen_at SET DEFAULT NOW(),
  ALTER COLUMN last_seen_at  SET DEFAULT NOW(),
  ALTER COLUMN first_seen_at SET NOT NULL,
  ALTER COLUMN last_seen_at  SET NOT NULL;

-- Filter common queries: "trends that broke in the last 24h"
CREATE INDEX IF NOT EXISTS trends_first_seen_at_idx
  ON public.trends (first_seen_at DESC);

COMMENT ON COLUMN public.trends.first_seen_at IS
  'When we first observed this trend in our pipeline. Set once on INSERT, never updated. Powers "broke Xh ago" copy.';
COMMENT ON COLUMN public.trends.last_seen_at IS
  'When we most recently observed this trend in a fetch run. Refreshed on every observation.';
COMMENT ON COLUMN public.trends.peaked_at IS
  'Time the current peak virality score was reached. NULL until at least one observation lower than the peak has been recorded.';
COMMENT ON COLUMN public.trends.peak_virality_score IS
  'Highest virality_score ever recorded for this trend.';
