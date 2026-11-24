import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const email = await currentMember();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const sub = (await req.json()) as { endpoint: string };
  if (!sub?.endpoint) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  const { error } = await supabaseAdmin().from("wa_push_subscriptions")
    .upsert({ endpoint: sub.endpoint, email, subscription: sub }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint: string };
  await supabaseAdmin().from("wa_push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
