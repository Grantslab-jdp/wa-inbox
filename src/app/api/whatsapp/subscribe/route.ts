import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subscribes every WhatsApp Business Account in wa_numbers to this app, so Meta sends its
// messages to our webhook. Idempotent and harmless to repeat; run it after adding a new number.
// It only ever subscribes our own WABAs (from the database) using the server-side token.
export async function POST() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("wa_numbers").select("waba_id").not("waba_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wabaIds = [...new Set((data ?? []).map((r) => r.waba_id as string))];
  const results: Record<string, unknown> = {};
  for (const id of wabaIds) {
    const url = `https://graph.facebook.com/${env.graphVersion}/${id}/subscribed_apps`;
    const auth = { Authorization: `Bearer ${env.waAccessToken}` };
    const sub = await fetch(url, { method: "POST", headers: auth });
    const list = await fetch(url, { headers: auth });
    const listed = (await list.json()) as { data?: { whatsapp_business_api_data?: { name?: string; id?: string } }[] };
    results[id] = {
      subscribe: { status: sub.status, body: await sub.json() },
      apps: (listed.data ?? []).map((a) => a.whatsapp_business_api_data?.name ?? a.whatsapp_business_api_data?.id),
    };
  }
  return NextResponse.json(results);
}
