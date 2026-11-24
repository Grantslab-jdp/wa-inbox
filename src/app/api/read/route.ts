import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { graph } from "@/lib/whatsapp/graph";

export const runtime = "nodejs";

// Clears the unread count and sends blue ticks for the customer's latest message.
export async function POST(req: NextRequest) {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { conversationId } = (await req.json()) as { conversationId: string };
  const db = supabaseAdmin();
  const { data: conv } = await db.from("wa_conversations").select("id, phone_number_id, unread_count").eq("id", conversationId).single();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conv.unread_count > 0) {
    await db.from("wa_conversations").update({ unread_count: 0 }).eq("id", conv.id);
    const { data: last } = await db.from("wa_messages").select("wamid")
      .eq("conversation_id", conv.id).eq("direction", "in").order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.wamid) {
      try {
        await graph(`${conv.phone_number_id}/messages`, {
          method: "POST", body: { messaging_product: "whatsapp", status: "read", message_id: last.wamid },
        });
      } catch { /* read receipts are best effort */ }
    }
  }
  return NextResponse.json({ ok: true });
}
