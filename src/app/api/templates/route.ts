import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { graph } from "@/lib/whatsapp/graph";

export const runtime = "nodejs";

type Tpl = { name: string; language: string; status: string; category: string; components: { type: string; text?: string }[] };

// Approved templates for the WhatsApp account that owns this phone number.
export async function GET(req: NextRequest) {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const pnid = req.nextUrl.searchParams.get("pnid");
  const { data: num } = await supabaseAdmin().from("wa_numbers").select("waba_id").eq("phone_number_id", pnid).single();
  if (!num?.waba_id) return NextResponse.json({ templates: [] });
  try {
    const res = await graph<{ data: Tpl[] }>(`${num.waba_id}/message_templates?status=APPROVED&limit=100&fields=name,language,status,category,components`);
    const templates = res.data.map((t) => {
      const body = t.components.find((c) => c.type === "BODY")?.text ?? "";
      const params = (body.match(/\{\{\d+\}\}/g) ?? []).length;
      return { name: t.name, language: t.language, category: t.category, body, params };
    });
    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, templates: [] }, { status: 502 });
  }
}
