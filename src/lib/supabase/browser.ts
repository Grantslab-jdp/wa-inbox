"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

// Realtime can connect before the session cookie is read, which makes it subscribe as anonymous and
// RLS then hides every row. Hand the user's token to realtime before subscribing.
export async function realtimeAuth(sb: SupabaseClient) {
  const { data } = await sb.auth.getSession();
  if (data.session) await sb.realtime.setAuth(data.session.access_token);
}
