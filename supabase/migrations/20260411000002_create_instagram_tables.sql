-- Instagram OAuth connections
CREATE TABLE IF NOT EXISTS instagram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  profile_picture_url TEXT,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'long_lived',
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

ALTER TABLE instagram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own instagram connection"
  ON instagram_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Synced posts pulled from Instagram Graph API
CREATE TABLE IF NOT EXISTS instagram_synced_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES instagram_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL,
  caption TEXT,
  permalink TEXT,
  media_type TEXT,
  posted_at TIMESTAMPTZ,
  impressions BIGINT,
  reach BIGINT,
  saved INTEGER,
  shares INTEGER,
  linked_request_id UUID REFERENCES hashtag_requests(id),
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ig_media_id)
);

ALTER TABLE instagram_synced_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own synced posts"
  ON instagram_synced_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
