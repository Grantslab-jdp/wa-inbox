import { notFound } from "next/navigation";
import { supabaseServer, currentMember } from "@/lib/supabase/server";
import NotMember from "@/components/NotMember";
import Thread from "@/components/Thread";
import type { Conversation, Draft, Member, Message, WaNumber } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await currentMember();
  if (!email) return <NotMember />;
  const sb = await supabaseServer();
  const { data: conv } = await sb.from("wa_conversations").select("*").eq("id", id).maybeSingle();
  if (!conv) notFound();
  const [{ data: number }, { data: messages }, { data: members }, { data: draft }] = await Promise.all([
    sb.from("wa_numbers").select("phone_number_id, label, display_phone_number, waba_id").eq("phone_number_id", conv.phone_number_id).single(),
    sb.from("wa_messages").select("id, conversation_id, wamid, direction, type, body, media_mime, media_filename, media_path, status, error, sent_by_email, sent_at")
      .eq("conversation_id", id).order("sent_at", { ascending: false }).limit(300),
    sb.from("wa_members").select("email, display_name").order("display_name"),
    sb.from("wa_drafts").select("*").eq("conversation_id", id).in("status", ["pending", "error"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <Thread
      conversation={conv as Conversation}
      number={number as WaNumber}
      initial={((messages ?? []) as Message[]).reverse()}
      me={email}
      members={(members ?? []) as Member[]}
      initialDraft={(draft as Draft) ?? null}
    />
  );
}
