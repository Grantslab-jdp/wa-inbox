"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SignOut({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button className={`text-sm text-muted underline ${className}`}
      onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); router.refresh(); }}>
      Sign out
    </button>
  );
}
