-- Hashtag Intelligence Engine
-- Stores requests and results for the Hashtag Analysis tool

CREATE TABLE IF NOT EXISTS hashtag_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_name      TEXT,
  platform        TEXT NOT NULL DEFAULT 'instagram',
  region          TEXT NOT NULL DEFAULT 'global',
  caption         TEXT NOT NULL,
  content_description TEXT,
  goal_type       TEXT NOT NULL DEFAULT 'reach',
  from_trend_quest JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hashtag_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID REFERENCES hashtag_requests(id) ON DELETE CASCADE,
  set_score             INTEGER,
  confidence_level      TEXT,
  distribution_readiness JSONB,
  hashtags              JSONB,
  why_this_works        TEXT,
  best_posting_time     TEXT,
  caption_keywords      TEXT[],
  warnings              TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS hashtag_requests_user_id_idx ON hashtag_requests(user_id);
CREATE INDEX IF NOT EXISTS hashtag_requests_created_at_idx ON hashtag_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS hashtag_results_request_id_idx ON hashtag_results(request_id);

-- RLS
ALTER TABLE hashtag_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own hashtag requests"
  ON hashtag_requests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own hashtag results"
  ON hashtag_results FOR ALL
  USING (
    request_id IN (
      SELECT id FROM hashtag_requests WHERE user_id = auth.uid()
    )
  );
