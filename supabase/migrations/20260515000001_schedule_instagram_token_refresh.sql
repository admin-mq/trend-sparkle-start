-- Schedule daily token refresh for Instagram connections expiring within 7 days
-- Runs at 09:00 UTC every day
SELECT cron.schedule(
  'refresh-instagram-tokens',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkwadhydveebpaqmgkei.supabase.co/functions/v1/refresh-instagram-tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrd2FkaHlkdmVlYnBhcW1na2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzk3MTEsImV4cCI6MjA4MDIxNTcxMX0.RRlc3qjIW7MUF5IBu4da-NXF3nnVDRy-N39jngKUXQ0"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
