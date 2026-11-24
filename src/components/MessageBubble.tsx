"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Message } from "@/lib/types";

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    supabaseBrowser().storage.from("wa-media").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  return url;
}

function Ticks({ status }: { status: string | null }) {
  if (status === "failed") return <span className="text-danger">!</span>;
  const read = status === "read";
  const double = status === "delivered" || read;
  return (
    <span className={read ? "text-sky-400" : "text-muted"} aria-label={status ?? "sending"}>
      {double ? "✓✓" : status === "sent" ? "✓" : "○"}
    </span>
  );
}

export default function MessageBubble({ m, me, time }: { m: Message; me: string; time: string }) {
  const out = m.direction === "out";
  const url = useSignedUrl(m.media_path);
  const mime = m.media_mime ?? "";
  const pendingMedia = !m.media_path && ["image", "document", "audio", "voice", "video", "sticker"].includes(m.type);
  const by = out && m.sent_by_email && m.sent_by_email !== me ? m.sent_by_email.split("@")[0] : null;
  const errText = m.status === "failed" ? errorText(m.error) : null;

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${out ? "bg-out rounded-br-md" : "bg-in rounded-bl-md"}`}>
        {by && <div className="text-[11px] text-accent mb-0.5 capitalize">{by}</div>}
        {m.type === "template" && <div className="text-[11px] text-muted mb-0.5">Template</div>}

        {url && (mime.startsWith("image/") || m.type === "sticker") && (
          <a href={url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={m.body ?? "Photo"} className={`rounded-lg mb-1 ${m.type === "sticker" ? "w-32" : "max-h-80 w-full object-cover"}`} />
          </a>
        )}
        {url && mime.startsWith("audio/") && (
          <div className="mb-1">
            {m.type === "voice" && <div className="text-[11px] text-muted mb-1">Voice note</div>}
            <audio controls preload="metadata" src={url} className="w-64 max-w-full" />
          </div>
        )}
        {url && mime.startsWith("video/") && <video controls preload="metadata" src={url} className="rounded-lg mb-1 max-h-80 w-full" />}
        {url && !mime.startsWith("image/") && !mime.startsWith("audio/") && !mime.startsWith("video/") && m.type !== "sticker" && (
          <a href={url} target="_blank" rel="noreferrer" download={m.media_filename ?? undefined}
            className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /></svg>
            <span className="truncate text-sm">{m.media_filename ?? "Document"}</span>
          </a>
        )}
        {pendingMedia && <div className="text-xs text-muted italic mb-1">Downloading {m.type}…</div>}

        {m.body && !(m.type === "document" && m.body === m.media_filename) && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
        )}
        {!m.body && !m.media_path && !pendingMedia && <p className="text-sm text-muted italic">[{m.type}]</p>}

        <div className="flex items-center justify-end gap-1 text-[11px] text-muted mt-0.5">
          <span>{time}</span>
          {out && <Ticks status={m.status} />}
        </div>
        {errText && <div className="text-[11px] text-danger mt-1">{errText}</div>}
      </div>
    </div>
  );
}

function errorText(err: unknown): string {
  const first = Array.isArray(err) ? err[0] : err;
  const e = first as { title?: string; message?: string; error_data?: { details?: string } } | null;
  return e?.error_data?.details || e?.message || e?.title || "Not delivered";
}
