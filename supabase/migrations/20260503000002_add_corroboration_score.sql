-- Tier 2 / Fix #8 — Cross-source corroboration score.
--
-- Today, a trend's "realness" is buried inside the opaque virality_score
-- (which mixes scoring against max, source bonus, region bonus, timing
-- bonus). Users can't see *why* virality is 87 vs 42 — and an LLM-only
-- single-source blip can score nearly as high as a 3-platform corroborated
-- real trend.
--
-- This column makes corroboration a first-class, transparent signal:
--   1 = single-platform (one of Google Trends, Reddit, YouTube)
--   2 = two distinct platforms agree
--   3 = all three platforms agree (highest credibility)
--
-- The score is the count of *distinct platforms* that confirmed the trend,
-- not the raw source count. So google_trends_uk + google_trends_us =
-- 1 platform (Google Trends), not 2 — that's a regional spread signal,
-- not a corroboration signal.
--
-- The UI surfaces this as a labeled credibility badge; the AI ranking
-- prompt uses it as an explicit ranking factor.

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS corroboration_score INT
    CHECK (corroboration_score BETWEEN 1 AND 3);

-- Backfill from existing source_signals[]. Map each source ID to its
-- platform, then count distinct platforms.
UPDATE public.trends
   SET corroboration_score = GREATEST(1, LEAST(3, (
     SELECT COUNT(DISTINCT
       CASE
         WHEN s LIKE 'google_trends%' THEN 'google_trends'
         WHEN s LIKE 'youtube%'        THEN 'youtube'
         WHEN s = 'reddit'             THEN 'reddit'
         ELSE s
       END)
     FROM unnest(COALESCE(source_signals, ARRAY[]::text[])) AS s
   )))
 WHERE corroboration_score IS NULL;

-- Anything still NULL after backfill (rows with empty source_signals[])
-- defaults to 1 — single-platform-of-record assumption is the most
-- conservative.
UPDATE public.trends
   SET corroboration_score = 1
 WHERE corroboration_score IS NULL;

-- Helpful index for "show me only multi-source-confirmed trends" filters.
CREATE INDEX IF NOT EXISTS trends_corroboration_score_idx
  ON public.trends (corroboration_score DESC);

COMMENT ON COLUMN public.trends.corroboration_score IS
  'Number of distinct platforms (Google Trends, Reddit, YouTube) that confirmed this trend. 1-3. Higher = more real.';
