import { createClient } from "@supabase/supabase-js";

export function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Dashboard copy/paste can introduce line breaks into long JWT keys.
  // Keep this server-side and never include the key in logs or responses.
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
