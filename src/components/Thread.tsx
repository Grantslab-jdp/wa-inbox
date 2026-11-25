"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser, realtimeAuth } from "@/lib/supabase/browser";
import { dayLabel, displayName, msgTime, prettyNumber, remaining } from "@/lib/format";
import { windowClosesAt } from "@/lib/window";
import type { Conversation, Message, WaNumber } from "@/lib/types";
import { Avatar } from "./Inbox";
import MessageBubble from "./MessageBubble";
import TemplatePicker from "./TemplatePicker";
import QuickReplies from "./QuickReplies";
import AttachSheet from "./AttachSheet";

const MSG_COLS = "id, conversation_id, wamid, direction, type, body, media_mime, media_filename, media_path, status, error, sent_by_email, sent_at";

export default function Thread({ conversation, number, initial, me }: {
  conversation: Conversation; number: WaNumber; initial: Message[]; me: string;
}) {
  const [conv, setConv] = useState(conversation);
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const bottom = useRef<HTMLDivElement>(null);

  const closesAt = windowClosesAt(conv.last_inbound_at);
  const open = closesAt !== null && now < closesAt;

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const mainRef = useRef<HTMLElement>(null);
  const stick = useRef(true);
  // Stay pinned to the newest message while images load, unless the user has scrolled up to read.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => { stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
    const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
    Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener("scroll", onScroll);
    return () => { ro.disconnect(); el.removeEventListener("scroll", onScroll); };
  }, [messages.length]);
  useEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  // Mark as read (and send blue ticks) when opened and whenever a new message arrives while viewing.
  const unread = conv.unread_count;
  useEffect(() => {
    if (unread > 0 && document.visibilityState === "visible") {
      fetch("/api/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: conv.id }) });
    }
  }, [unread, conv.id]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const upsert = (m: Message) => setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
      const next = prev.slice(); next[i] = { ...prev[i], ...m }; return next;
    });
    const ch = sb.channel(`thread-${conv.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages", filter: `conversation_id=eq.${conv.id}` },
        (p) => { if ((p.new as Message)?.id) upsert(p.new as Message); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wa_conversations", filter: `id=eq.${conv.id}` },
        (p) => setConv((c) => ({ ...c, ...(p.new as Conversation) })))
      ;
    realtimeAuth(sb).then(() => ch.subscribe((status, err) => { if (status !== "SUBSCRIBED") console.warn("realtime", status, err); }));
    const onVis = async () => {
      if (document.visibilityState !== "visible") return;
      const [{ data: msgs }, { data: c }] = await Promise.all([
        sb.from("wa_messages").select(MSG_COLS).eq("conversation_id", conv.id).order("sent_at", { ascending: false }).limit(300),
        sb.from("wa_conversations").select("*").eq("id", conv.id).single(),
      ]);
      if (msgs) setMessages((msgs as Message[]).reverse());
      if (c) setConv(c as Conversation);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, [conv.id]);

  async function send(body: object) {
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: conv.id, ...body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Send failed");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setSending(false); }
  }

  async function sendText(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || !open) return;
    if (await send({ text })) setText("");
  }

  const name = displayName(conv);
  let lastDay = "";

  return (
    <div className="h-dvh flex flex-col max-w-2xl mx-auto">
      <header className="shrink-0 bg-bg/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-2 h-14">
          <Link href="/" className="p-2 text-muted" aria-label="Back to inbox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <Avatar name={name} size={36} />
          <div className="min-w-0">
            <div className="truncate font-medium leading-tight">{name}</div>
            <div className="truncate text-xs text-muted">
              {conv.contact_name ? prettyNumber(conv.wa_id) + " · " : ""}{number?.label}
            </div>
          </div>
        </div>
        <div className={`px-4 py-1.5 text-xs ${open ? "text-accent" : "text-warn"}`}>
          {open
            ? `Reply window open, ${remaining(closesAt! - now)} left`
            : conv.last_inbound_at
              ? "Reply window closed. Only approved templates can be sent until they message again."
              : "They haven't messaged this number yet. Only approved templates can be sent."}
        </div>
      </header>

      <main ref={mainRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {messages.map((m) => {
          const day = dayLabel(m.sent_at);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <div className="text-center my-3"><span className="text-xs text-muted bg-panel rounded-full px-3 py-1">{day}</span></div>}
              <MessageBubble m={m} me={me} time={msgTime(m.sent_at)} />
            </div>
          );
        })}
        <div ref={bottom} />
      </main>

      <footer className="shrink-0 border-t border-line bg-bg px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {error && <p className="text-danger text-sm px-2 pb-2">{error}</p>}
        {open ? (
          <form onSubmit={sendText} className="flex items-end gap-1.5">
            <input ref={fileInput} type="file" hidden
              accept="image/jpeg,image/png,video/mp4,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }} />
            <IconButton label="Attach a photo or file" onClick={() => fileInput.current?.click()}>
              <path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7L14 5.5a3.5 3.5 0 015 5L10.5 19a2 2 0 01-3-3L15 8.5" />
            </IconButton>
            <IconButton label="Quick replies" onClick={() => setShowQuick(true)}>
              <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
            </IconButton>
            <IconButton label="Send a template" onClick={() => setShowTemplates(true)}>
              <path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" />
            </IconButton>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Message"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); sendText(); } }}
              className="flex-1 resize-none max-h-40 rounded-2xl bg-panel border border-line px-4 py-2.5 outline-none focus:border-accent field-sizing-content" />
            <button disabled={sending || !text.trim()} aria-label="Send"
              className="shrink-0 h-11 w-11 rounded-full bg-accent text-accent-ink flex items-center justify-center disabled:opacity-40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5l18-8.5L3 3.5v6.6l12 1.9-12 1.9z" /></svg>
            </button>
          </form>
        ) : (
          <button onClick={() => setShowTemplates(true)} className="w-full h-11 rounded-full bg-panel text-text font-medium">
            Send a template
          </button>
        )}
      </footer>

      {showQuick && (
        <QuickReplies pnid={conv.phone_number_id} firstName={(conv.contact_name ?? "").split(" ")[0]}
          onClose={() => setShowQuick(false)}
          onPick={(t) => { setText((cur) => (cur ? cur + " " : "") + t); setShowQuick(false); }} />
      )}

      {file && (
        <AttachSheet file={file} conversationId={conv.id} pnid={conv.phone_number_id}
          onClose={() => setFile(null)} onDone={() => setFile(null)} />
      )}

      {showTemplates && (
        <TemplatePicker pnid={conv.phone_number_id} sending={sending} onClose={() => setShowTemplates(false)}
          onSend={async (t) => { if (await send({ template: t })) setShowTemplates(false); }} />
      )}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="shrink-0 h-11 w-10 rounded-full text-muted flex items-center justify-center active:bg-panel">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  );
}
