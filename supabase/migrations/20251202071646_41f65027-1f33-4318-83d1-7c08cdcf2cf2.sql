-- Create trends table
CREATE TABLE public.trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_name TEXT NOT NULL,
  hashtags TEXT,
  region TEXT DEFAULT 'Global',
  premium_only BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can view active trends"
ON public.trends
FOR SELECT
USING (true);

-- Create index for common queries
CREATE INDEX idx_trends_region_active ON public.trends(region, active) WHERE active = true;
CREATE INDEX idx_trends_created_at ON public.trends(created_at DESC);