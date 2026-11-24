"use client";
import { useEffect, useState } from "react";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "unsupported" | "ios-install" | "off" | "on" | "denied" | "busy";

export default function PushToggle() {
  const [state, setState] = useState<State>("busy");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator)) return setState("unsupported");
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (!("PushManager" in window)) {
        // iOS only allows web push once the app is added to the Home Screen.
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        return setState(ios ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Re-send in case the server lost it; cheap and idempotent.
        fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      }
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push/key")).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      setState(r.ok ? "on" : "off");
    } catch { setState("off"); }
  }

  async function disable() {
    setState("busy");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
  }

  const cls = "text-sm";
  switch (state) {
    case "on": return <button className={`${cls} text-accent`} onClick={disable} title="Turn off notifications on this device">Alerts on</button>;
    case "off": return <button className={`${cls} text-muted underline`} onClick={enable}>Turn on alerts</button>;
    case "denied": return <span className={`${cls} text-muted`} title="Allow notifications for this site in your browser settings">Alerts blocked</span>;
    case "ios-install": return <span className={`${cls} text-muted`} title="On iPhone, use Share, then Add to Home Screen, and open the app from there">Add to Home Screen for alerts</span>;
    case "unsupported": return null;
    default: return <span className={`${cls} text-muted`}>…</span>;
  }
}
