-- Add tri-state ig_validated column to trends table.
--
-- Background: previously the only IG signal was the boolean `ig_confirmed`.
-- When the validateOnInstagram() web search timed out or didn't return a
-- topic, fetch-trends defaulted that topic to `ig_confirmed = false` — which
-- is indistinguishable from "we checked Instagram and found nothing." That
-- silently mislabels validation failures as confirmed-not-on-IG findings.
--
-- New scheme: tri-state `ig_validated` column with values:
--   'confirmed'  → IG aggregator post(s) found for the topic
--   'not_found'  → IG search ran successfully and returned zero matches
--   'unknown'    → validation step did not run, timed out, or returned no
--                  classification for this topic. UI must render this as
--                  ambiguous, not as a negative.
--
-- We keep `ig_confirmed` as a derived convenience boolean for backward
-- compatibility (true iff ig_validated = 'confirmed').

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS ig_validated TEXT
    CHECK (ig_validated IN ('confirmed', 'not_found', 'unknown'));

-- Backfill existing rows. We can only honestly distinguish the
-- "confirmed" case; everything else gets 'unknown' because we cannot
-- retroactively tell which old `ig_confirmed = false` rows were
-- genuinely-not-found vs validation-timeout.
UPDATE public.trends
   SET ig_validated = CASE
     WHEN ig_confirmed IS TRUE THEN 'confirmed'
     ELSE 'unknown'
   END
 WHERE ig_validated IS NULL;

COMMENT ON COLUMN public.trends.ig_validated IS
  'Tri-state IG aggregator validation: confirmed | not_found | unknown. ''unknown'' means validation did not produce a result and the UI must not render this as a negative.';
