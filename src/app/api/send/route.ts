import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { graph } from "@/lib/whatsapp/graph";
import { windowOpen } from "@/lib/window";

export const runtime = "nodejs";

type Body =
  | { conversationId: string; text: string }
  | { conversationId: string; template: { name: string; language: string; params: string[]; preview: string } };

export async function POST(req: NextRequest) {
  const email = await currentMember();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as Body;
  const db = supabaseAdmin();
  const { data: conv } = await db.from("wa_conversations")
    .select("id, phone_number_id, wa_id, last_inbound_at").eq("id", body.conversationId).single();
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  let payload: Record<string, unknown>;
  let type: string;
  let preview: string;
  if ("text" in body) {
    const text = body.text.trim();
    if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });
    // Enforced here as well as in the UI: free text only inside the 24-hour window.
    if (!windowOpen(conv.last_inbound_at)) {
      return NextResponse.json({ error: "The 24-hour window is closed. Send an approved template instead." }, { status: 409 });
    }
    payload = { type: "text", text: { body: text, preview_url: true } };
    type = "text";
    preview = text;
  } else {
    const t = body.template;
    payload = {
      type: "template",
      template: {
        name: t.name,
        language: { code: t.language },
        components: t.params.length
          ? [{ type: "body", parameters: t.params.map((p) => ({ type: "text", text: p })) }]
          : [],
      },
    };
    type = "template";
    preview = t.preview;
  }

  try {
    const res = await graph<{ messages: { id: string }[] }>(`${conv.phone_number_id}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", to: conv.wa_id, ...payload },
    });
    const wamid = res.messages[0].id;
    const { error } = await db.rpc("wa_record_outbound", {
      p_conversation_id: conv.id, p_wamid: wamid, p_type: type, p_body: preview, p_sent_by_email: email, p_raw: payload,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, wamid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
