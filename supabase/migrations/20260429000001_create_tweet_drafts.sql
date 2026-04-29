-- Tweet drafts persistence
-- Stores the 3 drafts produced by every "Generate tweets" click so users can
-- come back to them later instead of losing work on refresh.

CREATE TABLE public.tweet_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  brand_name TEXT,

  -- Groups the 3 drafts produced by a single click
  generation_id UUID NOT NULL,

  -- Trend snapshot at time of generation
  trend_name TEXT NOT NULL,
  trend_category TEXT,
  trend_metadata JSONB,
  region TEXT,
  topic_angle TEXT,

  -- The draft itself
  draft_id SMALLINT NOT NULL,            -- 1, 2 or 3 within a generation
  angle TEXT,
  tweet_text TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  char_limit INTEGER NOT NULL DEFAULT 280,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  over_limit BOOLEAN NOT NULL DEFAULT false,

  -- Live context provenance (lets us show "fetched from live search" later)
  live_context_source TEXT,              -- 'live' | 'stale' | 'none'
  live_context_preview TEXT,

  -- User actions
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tweet_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tweet drafts"
  ON public.tweet_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tweet drafts"
  ON public.tweet_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tweet drafts"
  ON public.tweet_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tweet drafts"
  ON public.tweet_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Hot path: list latest drafts for a user
CREATE INDEX idx_tweet_drafts_user_created
  ON public.tweet_drafts(user_id, created_at DESC);

-- Group lookups
CREATE INDEX idx_tweet_drafts_generation
  ON public.tweet_drafts(generation_id);

-- Filter by trend across history
CREATE INDEX idx_tweet_drafts_user_trend
  ON public.tweet_drafts(user_id, trend_name);
