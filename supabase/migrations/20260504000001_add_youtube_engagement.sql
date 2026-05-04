-- Tier 2 / Fix #6 — Real engagement signals (YouTube).
--
-- Until now, the only "engagement" we surfaced was virality_score — an
-- internal composite of (cross-source weight × source count × region × timing).
-- That number is honest as a *ranking* signal, but it doesn't answer the
-- question users actually ask: "is anyone really watching this?"
--
-- This migration adds real, externally-verifiable engagement evidence
-- pulled from YouTube Data API v3. For each trend, fetch-trends will:
--   1. Search YouTube for the most relevant recent video matching the topic
--   2. Pull view_count / like_count / comment_count from the videos endpoint
--   3. Store them with yt_fetched_at so the UI can show staleness
--
-- IMPORTANT honesty rules these columns enforce:
--   * NULL means "no good match found" — never fabricate or estimate.
--     If YouTube returns nothing, the UI must hide the engagement badge,
--     not show "0 views" (which would falsely imply we checked and the
--     video flopped).
--   * Below a 10K view floor we also store NULL — a 200-view video is
--     more likely an unrelated upload than proof that this trend has
--     real reach.
--   * yt_fetched_at lets the UI render "last refreshed Xh ago" so users
--     can tell if numbers are stale.
--   * No yt_engagement_rate, yt_quality_score, or other derived metrics
--     here. Same discipline as Tier 1: store the measurements, derive in
--     the read path if needed, never persist a confected score.
--
-- Reddit + TikTok engagement will be added in follow-up migrations once
-- their respective API credentials are in place. For now, NULL is the
-- honest answer for those platforms.

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS yt_video_id           TEXT,
  ADD COLUMN IF NOT EXISTS yt_video_title        TEXT,
  ADD COLUMN IF NOT EXISTS yt_channel_title      TEXT,
  ADD COLUMN IF NOT EXISTS yt_view_count         BIGINT,
  ADD COLUMN IF NOT EXISTS yt_like_count         BIGINT,
  ADD COLUMN IF NOT EXISTS yt_comment_count      BIGINT,
  ADD COLUMN IF NOT EXISTS yt_video_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS yt_fetched_at         TIMESTAMPTZ;

-- No backfill: existing rows have NULL for all yt_* columns by design.
-- They were ingested before YouTube enrichment existed; we have no
-- principled way to retroactively assign a "best matching video" without
-- spending API quota on stale rows. Going forward, fetch-trends populates
-- these on every observation. Stale rows naturally age out via the
-- 7-day deactivation cutoff.

-- Helpful index for "show me trends with proven YouTube reach" filters
-- (e.g. user wants to filter to trends with >100K views on YouTube).
-- DESC NULLS LAST so trends with real engagement bubble to the top and
-- NULL rows fall to the bottom — exactly what the UI wants.
CREATE INDEX IF NOT EXISTS trends_yt_view_count_idx
  ON public.trends (yt_view_count DESC NULLS LAST);

COMMENT ON COLUMN public.trends.yt_video_id IS
  'YouTube video ID of the best-matching recent video for this trend. NULL when no qualifying match was found (do NOT treat as zero reach).';
COMMENT ON COLUMN public.trends.yt_video_title IS
  'Title of the matched YouTube video. NULL when yt_video_id is NULL.';
COMMENT ON COLUMN public.trends.yt_channel_title IS
  'Channel name of the matched YouTube video. NULL when yt_video_id is NULL.';
COMMENT ON COLUMN public.trends.yt_view_count IS
  'View count of the matched YouTube video at last fetch. NULL = no match. Below 10K view floor we also store NULL — too noisy to be evidence.';
COMMENT ON COLUMN public.trends.yt_like_count IS
  'Like count at last fetch. NULL when no match OR when YouTube has like_count disabled for the video.';
COMMENT ON COLUMN public.trends.yt_comment_count IS
  'Comment count at last fetch. NULL when no match OR when comments are disabled for the video.';
COMMENT ON COLUMN public.trends.yt_video_published_at IS
  'When the matched YouTube video was published. Helps users gauge whether the trend is fresh or echoing an older upload.';
COMMENT ON COLUMN public.trends.yt_fetched_at IS
  'When fetch-trends last refreshed the yt_* stats. The UI uses this to render "X hours ago" and warn on stale numbers.';
