CREATE TABLE creator_reference_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_handle TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  follower_count INTEGER,
  why_inspiring TEXT,
  recent_captions JSONB,
  tone_analysis JSONB,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instagram_handle)
);

ALTER TABLE creator_reference_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reference accounts"
  ON creator_reference_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
