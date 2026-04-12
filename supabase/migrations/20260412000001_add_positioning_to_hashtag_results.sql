-- Add Content Positioning Analysis columns to hashtag_results
-- Stores the verdict, score, and full positioning data from the AI analysis

ALTER TABLE hashtag_results
  ADD COLUMN IF NOT EXISTS positioning_score   INTEGER,
  ADD COLUMN IF NOT EXISTS positioning_verdict TEXT,
  ADD COLUMN IF NOT EXISTS positioning_data    JSONB;
