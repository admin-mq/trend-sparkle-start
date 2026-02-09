
-- Create influencers table
CREATE TABLE public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  username text NOT NULL,
  followers integer NOT NULL DEFAULT 0,
  niche_audience text,
  geography text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- Users can view their own influencers
CREATE POLICY "Users can view their own influencers"
ON public.influencers FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own influencers
CREATE POLICY "Users can insert their own influencers"
ON public.influencers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own influencers
CREATE POLICY "Users can update their own influencers"
ON public.influencers FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own influencers
CREATE POLICY "Users can delete their own influencers"
ON public.influencers FOR DELETE
USING (auth.uid() = user_id);
