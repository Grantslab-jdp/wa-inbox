import { supabaseServer, currentMember } from "@/lib/supabase/server";
import NotMember from "@/components/NotMember";
import AgentSettings from "@/components/AgentSettings";
import type { WaNumber } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const email = await currentMember();
  if (!email) return <NotMember />;
  const sb = await supabaseServer();
  const { data: numbers } = await sb.from("wa_numbers")
    .select("phone_number_id, label, display_phone_number, waba_id, agent_config").not("label", "is", null).order("created_at");
  return <AgentSettings numbers={(numbers ?? []) as WaNumber[]} />;
}
