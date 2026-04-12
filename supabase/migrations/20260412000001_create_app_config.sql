-- App config table for storing server-side configuration values (e.g. API tokens)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only service role can access this table (edge functions use service role key)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No policies = no anon/authenticated access. Service role bypasses RLS entirely.
-- This means regular users cannot read these secrets via the client SDK.

-- Seed the Instagram access token (generated 2026-04-12, expires ~60 days)
INSERT INTO public.app_config (key, value)
VALUES ('INSTAGRAM_ACCESS_TOKEN', 'EAALHXcbN5jYBRByo8lPJAoUK0ZAjjc5fvRMmgbdMZBmGkNUQSzHJwbvq3lUH0v9Y8alsSU5HmiFxctBIQZAa8tEsDECxB6Ct6D0ZCeZA3KuVZBv0CqxADzimCOuLcfZA1yfMgErg3QPq1SfZBUhNksZCWN1GAQqIbFCGVhmel6OtL2Q1mI4ZCRZCXSCjaxQbQi8WeWTUbta213wAg4ct8bykuZBKbkoRn9NjADjmGqrlATmxIZAkFZB6J2xZClFpAZDZD')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
