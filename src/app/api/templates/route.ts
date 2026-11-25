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

type NewTpl = { name: string; category: "UTILITY" | "MARKETING"; language: string; body: string; examples: string[] };

// Submit a new template to Meta for review (members only).
export async function POST(req: NextRequest) {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { pnid, templates } = (await req.json()) as { pnid: string; templates: NewTpl[] };
  const { data: num } = await supabaseAdmin().from("wa_numbers").select("waba_id").eq("phone_number_id", pnid).single();
  if (!num?.waba_id) return NextResponse.json({ error: "Unknown number" }, { status: 404 });
  const results = [];
  for (const t of templates) {
    try {
      const body: Record<string, unknown> = { type: "BODY", text: t.body };
      if (t.examples.length) body.example = { body_text: [t.examples] };
      const res = await graph(`${num.waba_id}/message_templates`, {
        method: "POST",
        body: { name: t.name, category: t.category, language: t.language, components: [body] },
      });
      results.push({ name: t.name, ok: true, res });
    } catch (e) {
      results.push({ name: t.name, ok: false, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results });
}
