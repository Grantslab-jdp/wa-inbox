import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { pushToAll } from "../push";

// Minimal shapes of the Cloud API webhook payload we rely on.
type WaContact = { wa_id: string; profile?: { name?: string } };
type WaMedia = { id: string; mime_type?: string; filename?: string; caption?: string };
type WaMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WaMedia;
  document?: WaMedia;
  audio?: WaMedia & { voice?: boolean };
  video?: WaMedia;
  sticker?: WaMedia;
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { emoji?: string };
};
type WaStatus = { id: string; status: string; errors?: unknown[] };
type WaValue = {
  messaging_product: string;
  metadata: { phone_number_id: string; display_phone_number: string };
  contacts?: WaContact[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
};
export type WaWebhookPayload = {
  object: string;
  entry?: { id: string; changes?: { field: string; value: WaValue }[] }[];
};

const MEDIA_TYPES = ["image", "document", "audio", "video", "sticker"] as const;

function textOf(m: WaMessage): string | null {
  if (m.text) return m.text.body;
  for (const t of MEDIA_TYPES) if (m[t]?.caption) return m[t]!.caption!;
  if (m.button?.text) return m.button.text;
  if (m.interactive) return m.interactive.button_reply?.title ?? m.interactive.list_reply?.title ?? null;
  if (m.location) return [m.location.name, m.location.address, `${m.location.latitude},${m.location.longitude}`].filter(Boolean).join(" · ");
  if (m.reaction) return m.reaction.emoji ? `Reacted ${m.reaction.emoji}` : null;
  return null;
}

function mediaOf(m: WaMessage): WaMedia | null {
  for (const t of MEDIA_TYPES) if (m[t]) return m[t]!;
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/ogg": "ogg",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "video/mp4": "mp4",
  "application/pdf": "pdf",
};

// Media URLs from Meta expire after a few minutes, so fetch straight away and keep our own copy.
async function downloadMedia(db: SupabaseClient, phoneNumberId: string, wamid: string, media: WaMedia) {
  const auth = { Authorization: `Bearer ${env.waAccessToken}` };
  const metaRes = await fetch(`https://graph.facebook.com/${env.graphVersion}/${media.id}`, { headers: auth });
  if (!metaRes.ok) throw new Error(`media lookup ${metaRes.status}: ${await metaRes.text()}`);
  const meta = (await metaRes.json()) as { url: string; mime_type: string };
  const fileRes = await fetch(meta.url, { headers: auth });
  if (!fileRes.ok) throw new Error(`media download ${fileRes.status}`);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const mime = (meta.mime_type || media.mime_type || "application/octet-stream").split(";")[0].trim();
  const ext = media.filename?.split(".").pop() || EXT[mime] || "bin";
  const path = `${phoneNumberId}/${wamid}.${ext}`;
  const { error } = await db.storage.from("wa-media").upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  await db.from("wa_messages").update({ media_path: path, media_mime: mime }).eq("wamid", wamid);
}

export async function processWebhook(db: SupabaseClient, payload: WaWebhookPayload) {
  const errors: string[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const v = change.value;
      const phoneNumberId = v.metadata.phone_number_id;
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));

      for (const m of v.messages ?? []) {
        const media = mediaOf(m);
        const { data: newId, error } = await db.rpc("wa_record_inbound", {
          p_phone_number_id: phoneNumberId,
          p_display_phone_number: v.metadata.display_phone_number,
          p_wa_id: m.from,
          p_contact_name: names.get(m.from) ?? null,
          p_wamid: m.id,
          p_type: m.type === "audio" && m.audio?.voice ? "voice" : m.type,
          p_body: textOf(m),
          p_media_id: media?.id ?? null,
          p_media_mime: media?.mime_type ?? null,
          p_media_filename: media?.filename ?? null,
          p_sent_at: new Date(Number(m.timestamp) * 1000).toISOString(),
          p_raw: m,
        });
        if (error) { errors.push(`message ${m.id}: ${error.message}`); continue; }
        if (newId && media) {
          try { await downloadMedia(db, phoneNumberId, m.id, media); }
          catch (e) { errors.push(`media ${m.id}: ${(e as Error).message}`); }
        }
        if (newId) {
          try {
            const { data: msg } = await db.from("wa_messages").select("conversation_id").eq("id", newId).single();
            const name = names.get(m.from) ?? m.from;
            await pushToAll(db, {
              title: name,
              body: textOf(m) ?? (m.type === "audio" ? "Voice note" : m.type === "image" ? "Photo" : m.type === "document" ? "Document" : `[${m.type}]`),
              url: msg ? `/c/${msg.conversation_id}` : "/",
              tag: msg?.conversation_id,
            });
          } catch (e) { errors.push(`push ${m.id}: ${(e as Error).message}`); }
        }
      }

      for (const s of v.statuses ?? []) {
        const { error } = await db.rpc("wa_apply_status", {
          p_wamid: s.id, p_status: s.status, p_error: s.errors ? s.errors : null,
        });
        if (error) errors.push(`status ${s.id}: ${error.message}`);
      }
    }
  }
  return errors;
}
