import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type Vapid = { publicKey: string; privateKey: string };

// The VAPID key pair is generated once and kept server-side in wa_config (service role only),
// so there is no extra secret to copy into Vercel.
export async function getVapid(db: SupabaseClient): Promise<Vapid> {
  const { data } = await db.from("wa_config").select("value").eq("key", "vapid").maybeSingle();
  if (data?.value) return data.value as Vapid;
  const keys = webpush.generateVAPIDKeys();
  const { error } = await db.from("wa_config").insert({ key: "vapid", value: keys });
  if (error) {
    // Another request created it first; use that one.
    const again = await db.from("wa_config").select("value").eq("key", "vapid").single();
    return again.data!.value as Vapid;
  }
  return keys;
}

export async function pushToAll(db: SupabaseClient, payload: { title: string; body: string; url: string; tag?: string }) {
  const { data: subs } = await db.from("wa_push_subscriptions").select("endpoint, subscription");
  if (!subs?.length) return;
  const vapid = await getVapid(db);
  webpush.setVapidDetails("mailto:sales@moissanite.co.za", vapid.publicKey, vapid.privateKey);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload), { TTL: 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("wa_push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }));
}
