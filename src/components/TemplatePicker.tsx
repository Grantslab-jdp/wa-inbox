"use client";
import { useEffect, useState } from "react";

type Tpl = { name: string; language: string; category: string; body: string; params: number };
type Send = { name: string; language: string; params: string[]; preview: string };

export default function TemplatePicker({ pnid, onClose, onSend, sending }: {
  pnid: string; onClose: () => void; onSend: (t: Send) => void; sending: boolean;
}) {
  const [templates, setTemplates] = useState<Tpl[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<Tpl | null>(null);
  const [params, setParams] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/templates?pnid=${encodeURIComponent(pnid)}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) setError(j.error || "Couldn't load templates");
      setTemplates(j.templates ?? []);
    });
  }, [pnid]);

  const preview = pick ? pick.body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] || `{{${n}}}`) : "";
  const ready = pick && params.length === pick.params && params.every((p) => p.trim());

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-panel rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{pick ? pick.name.replace(/_/g, " ") : "Approved templates"}</h2>
          <button onClick={pick ? () => setPick(null) : onClose} className="text-sm text-muted">{pick ? "Back" : "Close"}</button>
        </div>

        {!pick && (
          <>
            {templates === null && <p className="text-muted text-sm">Loading…</p>}
            {error && <p className="text-danger text-sm mb-2">{error}</p>}
            {templates?.length === 0 && !error && (
              <p className="text-muted text-sm">No approved templates yet. Create them in WhatsApp Manager; they appear here once Meta approves them.</p>
            )}
            <ul className="space-y-2">
              {templates?.map((t) => (
                <li key={t.name + t.language}>
                  <button className="w-full text-left rounded-xl bg-panel-2 p-3"
                    onClick={() => { setPick(t); setParams(Array(t.params).fill("")); }}>
                    <div className="flex justify-between text-sm"><span className="font-medium">{t.name.replace(/_/g, " ")}</span><span className="text-muted text-xs">{t.language} · {t.category.toLowerCase()}</span></div>
                    <p className="text-sm text-muted mt-1 line-clamp-3 whitespace-pre-wrap">{t.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {pick && (
          <div className="space-y-3">
            {params.map((p, i) => (
              <label key={i} className="block">
                <span className="text-xs text-muted">{`{{${i + 1}}}`}</span>
                <input value={p} onChange={(e) => setParams(params.map((x, j) => (j === i ? e.target.value : x)))}
                  className="mt-1 w-full rounded-xl bg-bg border border-line px-3 py-2 outline-none focus:border-accent" />
              </label>
            ))}
            <div className="rounded-xl bg-out p-3 text-sm whitespace-pre-wrap">{preview}</div>
            <button disabled={!ready || sending} onClick={() => onSend({ name: pick.name, language: pick.language, params, preview })}
              className="w-full h-11 rounded-full bg-accent text-accent-ink font-semibold disabled:opacity-40">
              {sending ? "Sending…" : "Send template"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
