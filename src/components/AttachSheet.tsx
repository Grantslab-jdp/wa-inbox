"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Preview a chosen file, add a caption, upload to storage and send through WhatsApp.
export default function AttachSheet({ file, conversationId, pnid, onDone, onClose }: {
  file: File; conversationId: string; pnid: string; onDone: () => void; onClose: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const isImage = file.type === "image/jpeg" || file.type === "image/png";
  const isVideo = file.type.startsWith("video/");

  useEffect(() => {
    if (!isImage && !isVideo) return;
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file, isImage, isVideo]);

  async function send() {
    setBusy(true); setError(null);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
      const path = `out/${pnid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseBrowser().storage.from("wa-media")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw new Error(upErr.message);
      const r = await fetch("/api/send-media", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, path, filename: file.name, caption: caption.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Send failed");
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const mb = (file.size / 1024 / 1024).toFixed(1);
  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-lg bg-panel rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Send {isImage ? "photo" : isVideo ? "video" : "file"}</h2>
          <button onClick={onClose} disabled={busy} className="text-sm text-muted">Cancel</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && isImage && <img src={preview} alt="" className="max-h-72 w-full object-contain rounded-lg bg-bg" />}
        {preview && isVideo && <video src={preview} controls className="max-h-72 w-full rounded-lg bg-bg" />}
        {!isImage && !isVideo && (
          <div className="rounded-lg bg-bg px-3 py-3 text-sm truncate">{file.name} <span className="text-muted">· {mb} MB</span></div>
        )}
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption (optional)"
          className="w-full rounded-xl bg-bg border border-line px-3 py-2 outline-none focus:border-accent" />
        {error && <p className="text-danger text-sm">{error}</p>}
        <button onClick={send} disabled={busy} className="w-full h-11 rounded-full bg-accent text-accent-ink font-semibold disabled:opacity-50">
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
