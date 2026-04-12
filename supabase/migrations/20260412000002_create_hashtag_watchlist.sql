-- Hashtag Watchlist — lets users pin individual tags and track trend trajectory

CREATE TABLE IF NOT EXISTS hashtag_watchlist (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag               TEXT        NOT NULL,
  source_request_id UUID        REFERENCES hashtag_requests(id) ON DELETE SET NULL,
  source_set        TEXT,                          -- 'safe' | 'experimental'
  added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at   TIMESTAMPTZ,
  trend_status      TEXT,                          -- 'rising' | 'plateauing' | 'declining'
  trend_score       INTEGER,                       -- 0–100 momentum score
  trend_note        TEXT,                          -- one-sentence rationale
  UNIQUE(user_id, tag)
);

CREATE INDEX IF NOT EXISTS hashtag_watchlist_user_id_idx ON hashtag_watchlist(user_id);

ALTER TABLE hashtag_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist"
  ON hashtag_watchlist FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
