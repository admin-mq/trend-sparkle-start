-- Tier 3 / Fix #3 — Source-aware corroboration math.
--
-- Problem: today every trend's `corroboration_score` is computed against
-- a HARD-CODED max of 3 platforms (Google Trends + Reddit + YouTube),
-- regardless of how many platforms we actually managed to check during
-- that fetch run. Reddit is currently policy-gated and returns zero
-- signals. Result: every recommendation shows "2/3 platforms" — making
-- the entire system look weaker than it actually is. The user reads
-- "missing 1 platform" when the truth is "we checked everything we
-- could and got perfect corroboration."
--
-- This migration adds `corroboration_max` per trend = the number of
-- platforms that were actually CHECKED (not the number that returned
-- a signal — that's already captured in corroboration_score). When
-- Reddit comes online, max naturally bumps to 3 with no schema or UI
-- changes needed. The system "keeps the space" for Reddit without
-- making everything else suffer in the meantime.
--
-- Distinguishing "checked, no signal" from "didn't check at all" is
-- the same honesty pattern we used for yt_top_publishers (NULL =
-- couldn't check, [] = checked cleanly with zero items). Same spirit
-- applied here: a 2/2 must NOT look the same as 2/3.
--
-- Storage:
--   corroboration_max INT — number of platforms we successfully reached
--   for this fetch run. Clamped >= 1. NULL on rows from before this
--   migration (we don't have historical availability data; UI must
--   fall back gracefully — show "N platforms" without the /max ratio).
--
-- No backfill. Setting old rows to 3 would fabricate availability we
-- can't prove; setting to 2 (current Reddit-down state) would be a
-- guess. The honest move is NULL → UI degrades to the prior display
-- ("2 platforms" instead of "2/3 platforms") for legacy rows, and
-- new rows get the real number.

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS corroboration_max INT;

COMMENT ON COLUMN public.trends.corroboration_max IS
  'Number of distinct platforms we successfully reached during the fetch run that produced this trend (regardless of whether each one corroborated). corroboration_score / corroboration_max gives the honest ratio: "covered all platforms we checked" vs "missing platforms". NULL on rows from before Tier 3 / Fix #3 — UI must fall back to score-only display. When Reddit comes back online, max naturally bumps from 2 to 3 with no UI change.';
