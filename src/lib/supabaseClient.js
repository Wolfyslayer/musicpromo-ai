import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const arrivedFromOAuth = typeof window !== "undefined" && (
  new URLSearchParams(window.location.search).has("code")
  || new URLSearchParams(window.location.search).has("error_description")
  || window.location.hash.includes("access_token")
  || window.location.hash.includes("error_description")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    })
  : null;
