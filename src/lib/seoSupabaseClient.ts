import { createClient } from "@supabase/supabase-js";

const SEO_SUPABASE_URL = import.meta.env.VITE_SEO_SUPABASE_URL;
const SEO_SUPABASE_ANON_KEY = import.meta.env.VITE_SEO_SUPABASE_ANON_KEY;

export const seoSupabase = createClient(SEO_SUPABASE_URL, SEO_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Temporary verification log
console.log("[SEO Supabase] URL defined:", !!SEO_SUPABASE_URL);
console.log("[SEO Supabase] Key prefix:", SEO_SUPABASE_ANON_KEY?.substring(0, 10) + "…");
console.log("[SEO Supabase] Client initialized:", !!seoSupabase);
