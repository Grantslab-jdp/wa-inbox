import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Service-role client for the webhook and server actions. Bypasses RLS: never ship to the browser.
export function supabaseAdmin() {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
