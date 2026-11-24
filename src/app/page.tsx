import { supabaseServer, currentMember } from "@/lib/supabase/server";
import NotMember from "@/components/NotMember";
import Inbox from "@/components/Inbox";
import type { Conversation, WaNumber } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const email = await currentMember();
  if (!email) return <NotMember />;
  const sb = await supabaseServer();
  const [{ data: numbers }, { data: conversations }] = await Promise.all([
    sb.from("wa_numbers").select("phone_number_id, label, display_phone_number, waba_id").not("label", "is", null).order("created_at"),
    sb.from("wa_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(500),
  ]);
  return <Inbox numbers={(numbers ?? []) as WaNumber[]} initial={(conversations ?? []) as Conversation[]} />;
}
