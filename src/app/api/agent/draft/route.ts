import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createDraft } from "@/lib/agent/draft";

export const runtime = "nodejs";
export const maxDuration = 60;

// Someone tapped "Draft a reply" in a chat.
export async function POST(req: NextRequest) {
  const email = await currentMember();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { conversationId } = (await req.json()) as { conversationId: string };
  const r = await createDraft(supabaseAdmin(), conversationId, { requestedBy: email });
  if (r.ok) return NextResponse.json({ ok: true, draftId: r.draftId });
  if (r.skipped) return NextResponse.json({ error: r.reason }, { status: 409 });
  return NextResponse.json({ error: r.error }, { status: 502 });
}
