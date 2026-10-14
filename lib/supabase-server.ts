import { createClient } from "@supabase/supabase-js";

export function getServerSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  // Copying a key from the dashboard can introduce a line break. API keys never
  // contain whitespace, and a newline makes the HTTP Authorization header invalid.
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").replace(/\s+/g, "");

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
