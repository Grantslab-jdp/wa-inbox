"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { WaNumber } from "@/lib/types";

export default function AgentSettings({ numbers }: { numbers: WaNumber[] }) {
  return (
    <div className="min-h-dvh max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-2 h-14">
          <Link href="/" className="p-2 text-muted" aria-label="Back to inbox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <h1 className="text-lg font-semibold">Suggested replies</h1>
        </div>
      </header>
      <main className="px-4 py-4 space-y-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-muted">
          The agent drafts a reply for you to send, edit or dismiss. It never sends anything itself. It reads the chat,
          your notes and labels, website orders, live stock and retail prices, and the house rules below.
        </p>
        {numbers.map((n) => <NumberSettings key={n.phone_number_id} n={n} />)}
      </main>
    </div>
  );
}

function NumberSettings({ n }: { n: WaNumber }) {
  const [rules, setRules] = useState(n.agent_config?.house_rules ?? "");
  const [auto, setAuto] = useState(!!n.agent_config?.auto_draft);
  const [saved, setSaved] = useState(n.agent_config ?? {});
  const [status, setStatus] = useState<string | null>(null);
  const dirty = rules !== (saved.house_rules ?? "") || auto !== !!saved.auto_draft;

  async function save() {
    setStatus("Saving…");
    const next = { ...saved, house_rules: rules, auto_draft: auto };
    const { error } = await supabaseBrowser().from("wa_numbers").update({ agent_config: next }).eq("phone_number_id", n.phone_number_id);
    if (error) { setStatus(error.message); return; }
    setSaved(next);
    setStatus("Saved");
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium">{n.label}</h2>
      <label className="flex items-center justify-between gap-4 rounded-2xl bg-panel border border-line px-4 py-3">
        <span>
          <span className="block">Draft automatically</span>
          <span className="block text-xs text-muted">A suggested reply is ready when you open a chat. Off: tap the sparkle in a chat to draft.</span>
        </span>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="w-5 h-5 accent-[var(--accent)] shrink-0" />
      </label>
      <div>
        <div className="text-sm mb-1.5">House rules</div>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={18}
          className="w-full rounded-2xl bg-panel border border-line px-4 py-3 text-sm leading-relaxed outline-none focus:border-accent font-mono" />
        <p className="text-xs text-muted mt-1">Tone, delivery, warranty, returns, and when it must hand over to you. Prices come from the stock list, not from here.</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!dirty} className="h-10 px-5 rounded-full bg-accent text-accent-ink font-medium disabled:opacity-40">Save</button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </section>
  );
}
