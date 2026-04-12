-- Create brand_profiles table (no auth required, session-based)
CREATE TABLE public.brand_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  industry TEXT,
  industry_other TEXT,
  geography TEXT,
  business_summary TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on session_id for fast lookups
CREATE INDEX idx_brand_profiles_session_id ON public.brand_profiles(session_id);

-- Enable RLS
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to select brand profiles (filtered by session_id in app)
CREATE POLICY "Anyone can view brand profiles"
ON public.brand_profiles
FOR SELECT
USING (true);

-- Allow anyone to insert brand profiles
CREATE POLICY "Anyone can create brand profiles"
ON public.brand_profiles
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update brand profiles
CREATE POLICY "Anyone can update brand profiles"
ON public.brand_profiles
FOR UPDATE
USING (true);

-- Allow anyone to delete brand profiles
CREATE POLICY "Anyone can delete brand profiles"
ON public.brand_profiles
FOR DELETE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_brand_profiles_updated_at
BEFORE UPDATE ON public.brand_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();