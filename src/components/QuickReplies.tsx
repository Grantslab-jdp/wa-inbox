"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type QR = { id: string; title: string; body: string; phone_number_id: string | null };

// Saved snippets. {name} in a snippet becomes the customer's first name.
export default function QuickReplies({ pnid, firstName, onPick, onClose }: {
  pnid: string; firstName: string; onPick: (text: string) => void; onClose: () => void;
}) {
  const sb = supabaseBrowser();
  const [items, setItems] = useState<QR[] | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);

  async function load() {
    const { data } = await sb.from("wa_quick_replies").select("id, title, body, phone_number_id")
      .or(`phone_number_id.is.null,phone_number_id.eq.${pnid}`).order("title");
    setItems((data ?? []) as QR[]);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!title.trim() || !body.trim()) return;
    const { data: { user } } = await sb.auth.getUser();
    await sb.from("wa_quick_replies").insert({ title: title.trim(), body: body.trim(), phone_number_id: pnid, created_by: user?.email });
    setTitle(""); setBody(""); setAdding(false); load();
  }
  async function remove(id: string) {
    await sb.from("wa_quick_replies").delete().eq("id", id);
    load();
  }

  const shown = (items ?? []).filter((i) => !q || (i.title + " " + i.body).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-panel rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Quick replies</h2>
          <div className="flex gap-4 text-sm">
            {!adding && items && items.length > 0 && (
              <button className="text-muted" onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit"}</button>
            )}
            <button className="text-muted" onClick={onClose}>Close</button>
          </div>
        </div>

        {adding ? (
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name, e.g. Delivery times"
              className="w-full rounded-xl bg-bg border border-line px-3 py-2 outline-none focus:border-accent" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              placeholder={"The message. Use {name} for their first name."}
              className="w-full rounded-xl bg-bg border border-line px-3 py-2 outline-none focus:border-accent" />
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 h-11 rounded-full bg-panel-2">Cancel</button>
              <button onClick={save} disabled={!title.trim() || !body.trim()}
                className="flex-1 h-11 rounded-full bg-accent text-accent-ink font-semibold disabled:opacity-40">Save</button>
            </div>
          </div>
        ) : (
          <>
            {items && items.length > 4 && (
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
                className="w-full mb-3 rounded-xl bg-bg border border-line px-3 py-2 outline-none focus:border-accent" />
            )}
            {items === null && <p className="text-muted text-sm">Loading…</p>}
            {items?.length === 0 && <p className="text-muted text-sm mb-3">No quick replies yet. Add the things you type often, like delivery times or care tips.</p>}
            <ul className="space-y-2 mb-3">
              {shown.map((i) => (
                <li key={i.id} className="flex items-start gap-2">
                  <button className="flex-1 text-left rounded-xl bg-panel-2 p-3"
                    onClick={() => onPick(i.body.replace(/\{name\}/gi, firstName))}>
                    <div className="text-sm font-medium">{i.title}</div>
                    <p className="text-sm text-muted mt-1 line-clamp-2 whitespace-pre-wrap">{i.body}</p>
                  </button>
                  {editing && <button onClick={() => remove(i.id)} className="text-danger text-sm px-2 py-3">Delete</button>}
                </li>
              ))}
            </ul>
            <button onClick={() => setAdding(true)} className="w-full h-11 rounded-full bg-panel-2 text-sm">+ Add a quick reply</button>
          </>
        )}
      </div>
    </div>
  );
}
