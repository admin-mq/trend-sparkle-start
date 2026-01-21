-- Create user_profiles table
CREATE TABLE public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  brand_name TEXT,
  industry TEXT,
  industry_other TEXT,
  geography TEXT,
  business_summary TEXT,
  logo_url TEXT,
  website TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  linkedin TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-logos', 'brand-logos', true);

-- Storage policies
CREATE POLICY "Anyone can view brand logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'brand-logos');

CREATE POLICY "Users can upload their own brand logo"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own brand logo"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own brand logo"
ON storage.objects
FOR DELETE
USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);