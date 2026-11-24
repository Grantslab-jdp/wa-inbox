import "server-only";
import { env } from "../env";

export async function graph<T = unknown>(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`https://graph.facebook.com/${env.graphVersion}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${env.waAccessToken}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } }).error?.message ?? `Graph ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

