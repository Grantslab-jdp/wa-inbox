"use client";
import type { Draft } from "@/lib/types";

// The agent's suggested reply, shown above the message box. Nothing is sent until someone taps Send.
export default function DraftCard({ draft, drafting, sending, onSend, onEdit, onDismiss, onRetry }: {
  draft: Draft | null; drafting: boolean; sending: boolean;
  onSend: () => void; onEdit: () => void; onDismiss: () => void; onRetry: () => void;
}) {
  if (drafting) {
    return (
      <div className="mx-1 mb-2 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        Drafting a reply…
      </div>
    );
  }
  if (!draft) return null;

  if (draft.status === "error") {
    return (
      <div className="mx-1 mb-2 rounded-2xl border border-line bg-panel px-4 py-3 text-sm flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-muted">Couldn&apos;t draft a reply.</div>
          {draft.error && <div className="text-xs text-muted/80 mt-0.5 break-words">{draft.error}</div>}
        </div>
        <button onClick={onRetry} className="text-accent text-sm shrink-0">Try again</button>
        <button onClick={onDismiss} className="text-muted text-sm shrink-0">Hide</button>
      </div>
    );
  }

  return (
    <div className={`mx-1 mb-2 rounded-2xl border bg-panel px-4 pt-2.5 pb-2 ${draft.needs_human ? "border-warn/60" : "border-accent/40"}`}>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-accent font-medium">Suggested reply</span>
        {draft.needs_human && <span className="uppercase tracking-wide text-[10px] text-warn border border-warn/60 rounded px-1">needs you</span>}
      </div>
      {draft.reason && <div className="text-xs text-muted mt-0.5">{draft.reason}</div>}
      <p className="whitespace-pre-wrap text-[15px] leading-snug mt-2 max-h-48 overflow-y-auto">{draft.body}</p>
      <div className="flex items-center justify-end gap-1 mt-2">
        <button onClick={onDismiss} className="px-3 h-9 rounded-full text-sm text-muted">Dismiss</button>
        <button onClick={onEdit} className="px-3 h-9 rounded-full text-sm bg-panel-2">Edit</button>
        <button onClick={onSend} disabled={sending} className="px-4 h-9 rounded-full text-sm bg-accent text-accent-ink font-medium disabled:opacity-40">Send</button>
      </div>
    </div>
  );
}
