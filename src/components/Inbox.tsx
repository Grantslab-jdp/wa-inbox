"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser, realtimeAuth } from "@/lib/supabase/browser";
import { displayName, listTime } from "@/lib/format";
import { windowOpen } from "@/lib/window";
import type { Conversation, WaNumber } from "@/lib/types";
import PushToggle from "./PushToggle";
import SignOut from "./SignOut";

const TAB_KEY = "wa-inbox-number";

export default function Inbox({ numbers, initial }: { numbers: WaNumber[]; initial: Conversation[] }) {
  const [convs, setConvs] = useState(initial);
  const [tab, setTab] = useState<string>(numbers[0]?.phone_number_id ?? "");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try { const saved = localStorage.getItem(TAB_KEY); if (saved && numbers.some((n) => n.phone_number_id === saved)) setTab(saved); } catch {}
  }, [numbers]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Live updates: any change to a conversation row (new message, unread reset) re-sorts the list.
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, (p) => {
        const row = p.new as Conversation;
        if (!row?.id) return;
        setConvs((prev) => [row, ...prev.filter((c) => c.id !== row.id)]
          .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "")));
      })
      ;
    realtimeAuth(sb).then(() => ch.subscribe((status, err) => { if (status !== "SUBSCRIBED") console.warn("realtime", status, err); }));
    // Catch up after the app returns from the background.
    const onVis = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await sb.from("wa_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(500);
      if (data) setConvs(data as Conversation[]);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const unreadBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of convs) m.set(c.phone_number_id, (m.get(c.phone_number_id) ?? 0) + (c.unread_count > 0 ? 1 : 0));
    return m;
  }, [convs]);

  const list = convs.filter((c) => c.phone_number_id === tab);

  return (
    <div className="min-h-dvh flex flex-col max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <div className="flex items-center gap-4"><PushToggle /><SignOut /></div>
        </div>
        {numbers.length > 1 && (
          <nav className="flex gap-1 px-2 pb-2 overflow-x-auto">
            {numbers.map((n) => {
              const u = unreadBy.get(n.phone_number_id) ?? 0;
              const active = n.phone_number_id === tab;
              return (
                <button key={n.phone_number_id}
                  onClick={() => { setTab(n.phone_number_id); try { localStorage.setItem(TAB_KEY, n.phone_number_id); } catch {} }}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${active ? "bg-accent text-accent-ink font-medium" : "bg-panel text-muted"}`}>
                  {n.label}{u > 0 && <span className={`ml-1.5 ${active ? "" : "text-accent"}`}>{u}</span>}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {list.length === 0 ? (
        <p className="text-muted text-center mt-20 px-6">No conversations yet. New WhatsApp messages will appear here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((c) => {
            const open = windowOpen(c.last_inbound_at, now);
            return (
              <li key={c.id}>
                <Link href={`/c/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-panel">
                  <Avatar name={displayName(c)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${c.unread_count ? "font-semibold" : ""}`}>{displayName(c)}</span>
                      <span className={`text-xs shrink-0 ${c.unread_count ? "text-accent" : "text-muted"}`}>{listTime(c.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="truncate text-sm text-muted">{c.last_message_preview ?? ""}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {!open && <span className="text-[10px] uppercase tracking-wide text-muted border border-line rounded px-1">closed</span>}
                        {c.unread_count > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-accent-ink text-xs font-semibold flex items-center justify-center">{c.unread_count}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.replace(/^\+/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
      style={{ width: size, height: size, background: `hsl(${h} 30% 24%)`, color: `hsl(${h} 60% 80%)` }}>
      {initials || "?"}
    </span>
  );
}
