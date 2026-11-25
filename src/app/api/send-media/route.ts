import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { graph } from "@/lib/whatsapp/graph";
import { windowOpen } from "@/lib/window";

export const runtime = "nodejs";
export const maxDuration = 60;

// WhatsApp's own rules for what can go as which message type.
function kindOf(mime: string): "image" | "video" | "audio" | "document" {
  if (mime === "image/jpeg" || mime === "image/png") return "image";
  if (mime === "video/mp4" || mime === "video/3gpp") return "video";
  if (["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"].includes(mime)) return "audio";
  return "document";
}
const LIMIT: Record<string, number> = { image: 5, video: 16, audio: 16, document: 100 };

// The browser uploads the file to storage (out/...) first, so large files don't pass through this function.
export async function POST(req: NextRequest) {
  const email = await currentMember();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { conversationId, path, filename, caption } = (await req.json()) as {
    conversationId: string; path: string; filename: string; caption?: string;
  };
  if (!path?.startsWith("out/")) return NextResponse.json({ error: "Bad file path" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: conv } = await db.from("wa_conversations")
    .select("id, phone_number_id, wa_id, last_inbound_at").eq("id", conversationId).single();
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (!windowOpen(conv.last_inbound_at)) {
    return NextResponse.json({ error: "The 24-hour window is closed. Send a template first." }, { status: 409 });
  }

  const { data: blob, error: dlErr } = await db.storage.from("wa-media").download(path);
  if (dlErr || !blob) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  const mime = (blob.type || "application/octet-stream").split(";")[0];
  const kind = kindOf(mime);
  if (blob.size > LIMIT[kind] * 1024 * 1024) {
    return NextResponse.json({ error: `WhatsApp allows ${kind}s up to ${LIMIT[kind]} MB.` }, { status: 413 });
  }

  try {
    // 1. Upload the file to WhatsApp.
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new File([blob], filename || "file", { type: mime }));
    const up = await fetch(`https://graph.facebook.com/${env.graphVersion}/${conv.phone_number_id}/media`, {
      method: "POST", headers: { Authorization: `Bearer ${env.waAccessToken}` }, body: form,
    });
    const upJson = (await up.json()) as { id?: string; error?: { message?: string } };
    if (!up.ok || !upJson.id) throw new Error(upJson.error?.message ?? `Media upload ${up.status}`);

    // 2. Send it.
    const media: Record<string, string> = { id: upJson.id };
    if (caption && kind !== "audio") media.caption = caption;
    if (kind === "document") media.filename = filename;
    const payload = { type: kind, [kind]: media };
    const res = await graph<{ messages: { id: string }[] }>(`${conv.phone_number_id}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", to: conv.wa_id, ...payload },
    });
    const wamid = res.messages[0].id;

    // 3. Record it, pointing at our stored copy.
    const { error } = await db.rpc("wa_record_outbound", {
      p_conversation_id: conv.id, p_wamid: wamid, p_type: kind,
      p_body: caption || (kind === "document" ? filename : null), p_sent_by_email: email, p_raw: payload,
    });
    if (error) throw error;
    await db.from("wa_messages").update({ media_path: path, media_mime: mime, media_filename: filename, media_id: upJson.id }).eq("wamid", wamid);
    return NextResponse.json({ ok: true, wamid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
