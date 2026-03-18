import { createClient } from "@supabase/supabase-js";

const SEO_SUPABASE_URL = "https://njnnpdrevbkhbhzwccuz.supabase.co";
const SEO_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbm5wZHJldmJraGJoendjY3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTg3ODQsImV4cCI6MjA3OTk3NDc4NH0.WKuei-3pR2TphEKjSOOhvNlECrX93Jt9NE5SK2TcD-M";

export const seoSupabase = createClient(SEO_SUPABASE_URL, SEO_SUPABASE_ANON_KEY, {
  auth: {
    storageKey: "sb-njnnpdrevbkhbhzwccuz-auth-token-seo",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// Verification log (first 10 chars only)
console.log("[SEO Supabase] URL:", SEO_SUPABASE_URL);
console.log("[SEO Supabase] Key prefix:", SEO_SUPABASE_ANON_KEY.substring(0, 10) + "…");
console.log("[SEO Supabase] Client initialized:", !!seoSupabase);
