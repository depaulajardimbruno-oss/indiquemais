"use client";

import { useRouter } from "next/navigation";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();
  if (!hasSupabase) return null;
  return (
    <button
      onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/entrar"); }}
      className="rounded-brand border border-line px-3 py-2 text-sm font-medium hover:bg-brand-soft"
    >
      Sair
    </button>
  );
}
