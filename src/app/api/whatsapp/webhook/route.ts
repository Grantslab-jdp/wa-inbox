import { NextRequest, NextResponse, after } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidSignature } from "@/lib/whatsapp/signature";
import { processWebhook, type WaWebhookPayload } from "@/lib/whatsapp/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta's one-off verification handshake when the webhook URL is saved in the app dashboard.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === env.waVerifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidSignature(raw, req.headers.get("x-hub-signature-256"), env.waAppSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WaWebhookPayload;
  try { payload = JSON.parse(raw); } catch { return new NextResponse("Bad JSON", { status: 400 }); }

  // Store the delivery verbatim first, so nothing is lost even if processing fails.
  const db = supabaseAdmin();
  const { data: event, error } = await db.from("wa_webhook_events").insert({ payload }).select("id").single();
  if (error) {
    // Non-200 makes Meta retry later, which is what we want if the database is unavailable.
    console.error("webhook store failed", error);
    return new NextResponse("Store failed", { status: 500 });
  }

  // Acknowledge quickly; do the parsing and media downloads after the response.
  after(async () => {
    let errors: string[] = [];
    try { errors = await processWebhook(db, payload); }
    catch (e) { errors = [(e as Error).message]; }
    await db.from("wa_webhook_events")
      .update({ processed_at: new Date().toISOString(), error: errors.length ? errors.join("\n") : null })
      .eq("id", event.id);
    if (errors.length) console.error("webhook processing errors", errors);
  });

  return NextResponse.json({ ok: true });
}
