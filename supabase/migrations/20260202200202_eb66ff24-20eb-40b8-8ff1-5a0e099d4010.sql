-- Modify existing user_profiles table to add auth-related columns
-- Add account_type column with default for existing rows
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'brand';

-- Add constraint for account_type
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_account_type_check 
CHECK (account_type IN ('brand', 'creator'));

-- Add email column (store for convenience)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Add location column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS location text;

-- Add created_at column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type ON public.user_profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_brand_name ON public.user_profiles(brand_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Drop existing RLS policies (they may have restrictive issues)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

-- Create new RLS policies
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

-- Create or replace the updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();