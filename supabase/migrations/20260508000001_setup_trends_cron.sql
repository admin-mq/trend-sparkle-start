-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule fetch-trends-all-regions to run every 6 hours
SELECT cron.schedule(
  'fetch-trends-all-regions',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkwadhydveebpaqmgkei.supabase.co/functions/v1/fetch-trends-all-regions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrd2FkaHlkdmVlYnBhcW1na2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzk3MTEsImV4cCI6MjA4MDIxNTcxMX0.RRlc3qjIW7MUF5IBu4da-NXF3nnVDRy-N39jngKUXQ0"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- Immediate seed: trigger one run right now for all 6 regions
SELECT net.http_post(
  url := 'https://xkwadhydveebpaqmgkei.supabase.co/functions/v1/fetch-trends-all-regions',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrd2FkaHlkdmVlYnBhcW1na2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzk3MTEsImV4cCI6MjA4MDIxNTcxMX0.RRlc3qjIW7MUF5IBu4da-NXF3nnVDRy-N39jngKUXQ0"}'::jsonb,
  body := '{}'::jsonb
);
