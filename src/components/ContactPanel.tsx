"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { displayName, prettyNumber } from "@/lib/format";
import { PRESET_LABELS, labelColour } from "@/lib/labels";
import type { Conversation, Member } from "@/lib/types";

type Order = { id: string; ref: string | null; amount_zar: number; status: string; created_at: string; name: string };

export default function ContactPanel({ conv, members, me, onChange, onClose }: {
  conv: Conversation; members: Member[]; me: string;
  onChange: (patch: Partial<Conversation>) => void; onClose: () => void;
}) {
  const sb = supabaseBrowser();
  const [notes, setNotes] = useState(conv.notes ?? "");
  const [custom, setCustom] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [saved, setSaved] = useState<"" | "saving" | "saved">("");

  useEffect(() => {
    sb.rpc("wa_orders_for", { p_wa_id: conv.wa_id }).then(({ data }) => setOrders((data ?? []) as Order[]));
  }, [conv.wa_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(p: Partial<Conversation>) {
    onChange(p);
    await sb.from("wa_conversations").update(p).eq("id", conv.id);
  }

  async function saveNotes() {
    if ((conv.notes ?? "") === notes) return;
    setSaved("saving");
    await patch({ notes: notes.trim() ? notes : null });
    setSaved("saved");
  }

  function toggle(label: string) {
    const has = conv.labels.includes(label);
    patch({ labels: has ? conv.labels.filter((l) => l !== label) : [...conv.labels, label] });
  }

  const allLabels = Array.from(new Set([...PRESET_LABELS, ...conv.labels]));

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => { saveNotes(); onClose(); }}>
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-panel rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg">{displayName(conv)}</h2>
            <p className="text-sm text-muted">{prettyNumber(conv.wa_id)}</p>
          </div>
          <button onClick={() => { saveNotes(); onClose(); }} className="text-sm text-muted">Done</button>
        </div>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Handled by</h3>
          <div className="flex flex-wrap gap-2">
            {[{ email: null, display_name: "Nobody yet" }, ...members].map((m) => {
              const active = conv.assigned_to === m.email;
              return (
                <button key={m.email ?? "none"} onClick={() => patch({ assigned_to: m.email })}
                  className={`px-3 py-1.5 rounded-full text-sm ${active ? "bg-accent text-accent-ink font-medium" : "bg-panel-2 text-muted"}`}>
                  {m.email === me ? "Me" : m.display_name ?? m.email}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Labels</h3>
          <div className="flex flex-wrap gap-2">
            {allLabels.map((l) => {
              const on = conv.labels.includes(l);
              return (
                <button key={l} onClick={() => toggle(l)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${on ? "border-transparent text-bg font-medium" : "border-line text-muted"}`}
                  style={on ? { background: labelColour(l) } : undefined}>
                  {l}
                </button>
              );
            })}
          </div>
          <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); const l = custom.trim(); if (l && !conv.labels.includes(l)) toggle(l); setCustom(""); }}>
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="New label"
              className="flex-1 rounded-xl bg-bg border border-line px-3 py-2 text-sm outline-none focus:border-accent" />
            <button disabled={!custom.trim()} className="px-4 rounded-xl bg-panel-2 text-sm disabled:opacity-40">Add</button>
          </form>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-muted">Notes</h3>
            <span className="text-xs text-muted">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}</span>
          </div>
          <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(""); }} onBlur={saveNotes} rows={5}
            placeholder="Ring size, budget, what they're looking for…"
            className="w-full rounded-xl bg-bg border border-line px-3 py-2 outline-none focus:border-accent" />
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Website orders</h3>
          {orders === null && <p className="text-sm text-muted">Looking up…</p>}
          {orders?.length === 0 && <p className="text-sm text-muted">No orders on moissanite.co.za with this phone number.</p>}
          <ul className="space-y-2">
            {orders?.map((o) => (
              <li key={o.id}>
                <a href="https://www.moissanite.co.za/admin/orders" target="_blank" rel="noreferrer"
                  className="flex justify-between rounded-xl bg-panel-2 px-3 py-2 text-sm">
                  <span>{new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {o.status}{o.ref ? ` · ${o.ref}` : ""}</span>
                  <span>R {Number(o.amount_zar).toLocaleString("en-ZA")}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
