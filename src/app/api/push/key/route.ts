import { NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getVapid } from "@/lib/push";

export const runtime = "nodejs";

export async function GET() {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { publicKey } = await getVapid(supabaseAdmin());
  return NextResponse.json({ publicKey });
}
