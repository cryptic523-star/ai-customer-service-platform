// Creates the Supabase connection using the SECRET service-role key.
// This key bypasses Row Level Security, so it must only ever be used here on
// the server. Only src/db/repository.ts should import this file.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.startsWith("REPLACE_ME") || key.startsWith("REPLACE_ME")) {
    throw new Error("Supabase is not configured");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
