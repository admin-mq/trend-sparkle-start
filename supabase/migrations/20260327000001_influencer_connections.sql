-- Extend influencers table with contact and collaboration fields
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS barter_open BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_date TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Connection requests: links a brand (auth user) with an influencer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id      UUID        NOT NULL,
  brand_email   TEXT,
  influencer_id UUID        REFERENCES public.influencers(id) ON DELETE CASCADE NOT NULL,
  message       TEXT,
  status        TEXT        DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, influencer_id)
);

-- Row Level Security
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- Brands can create their own requests
CREATE POLICY "brands_insert_own_requests"
ON public.connection_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = brand_id);

-- All authenticated users can view requests
-- (brands filter by brand_id in queries; admin sees all)
CREATE POLICY "authenticated_view_requests"
ON public.connection_requests
FOR SELECT TO authenticated
USING (true);

-- Allow status updates (admin sets accepted / declined)
CREATE POLICY "authenticated_update_requests"
ON public.connection_requests
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
