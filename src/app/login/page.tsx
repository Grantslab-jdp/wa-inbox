"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message); return; }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-muted text-sm mt-1">Sign in with your moissanite.co.za account.</p>
        </div>
        <label className="block">
          <span className="text-sm text-muted">Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl bg-panel border border-line px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-panel border border-line px-4 py-3 outline-none focus:border-accent" />
        </label>
        {error && <p className="text-danger text-sm">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-accent text-accent-ink font-semibold py-3 disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
