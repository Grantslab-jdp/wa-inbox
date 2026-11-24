const TZ = "Africa/Johannesburg";

export function listTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toLocaleDateString("en-GB", { timeZone: TZ }) === now.toLocaleDateString("en-GB", { timeZone: TZ });
  if (sameDay) return d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 6) return d.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short" });
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
}

export function msgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}

export function displayName(c: { contact_name: string | null; wa_id: string }): string {
  return c.contact_name || prettyNumber(c.wa_id);
}

// wa_id is usually an E.164 number without "+", but may become a business-scoped user ID.
export function prettyNumber(waId: string): string {
  if (!/^\d{8,15}$/.test(waId)) return waId;
  if (waId.startsWith("27") && waId.length === 11) return `+27 ${waId.slice(2, 4)} ${waId.slice(4, 7)} ${waId.slice(7)}`;
  return `+${waId}`;
}

export function remaining(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
