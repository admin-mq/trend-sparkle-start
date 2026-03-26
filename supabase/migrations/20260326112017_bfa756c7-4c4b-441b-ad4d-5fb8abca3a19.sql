
CREATE TABLE public.amcue_brand_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT,
  company_description TEXT,
  industry TEXT,
  business_model TEXT,
  usp TEXT,
  target_audience TEXT,
  geographic_markets TEXT[] DEFAULT '{}',
  products_services TEXT,
  marketing_goals TEXT[] DEFAULT '{}',
  biggest_marketing_challenge TEXT,
  current_channels JSONB DEFAULT '{}',
  monthly_marketing_budget_usd NUMERIC,
  average_order_value_usd NUMERIC,
  customer_ltv_usd NUMERIC,
  competitors TEXT[] DEFAULT '{}',
  brand_voice TEXT,
  notes TEXT,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.amcue_brand_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand memory"
  ON public.amcue_brand_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brand memory"
  ON public.amcue_brand_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brand memory"
  ON public.amcue_brand_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_amcue_brand_memory_updated_at
  BEFORE UPDATE ON public.amcue_brand_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
