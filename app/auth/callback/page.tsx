"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function CallbackPage() {
  const [erro, setErro] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const destino = params.get("destino");
    const sb = supabaseBrowser();
    (async () => {
      if (!code) return setErro("O link está incompleto. Peça um novo na tela de entrada.");
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) return setErro("Este link já foi usado ou venceu. Peça um novo na tela de entrada.");
      const { data: isAdmin } = await sb.rpc("is_platform_admin");
      const seguro = destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : null;
      location.replace(seguro ?? (isAdmin === true ? "/admin" : "/conta"));
    })();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <Card>
        {erro ? (
          <>
            <h1 className="text-xl font-semibold">Não foi possível entrar</h1>
            <p className="mt-1 text-sm text-muted">{erro}</p>
            <Link href="/entrar" className="mt-4 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg">Voltar para a entrada</Link>
          </>
        ) : (
          <p role="status" className="text-sm text-muted">Entrando…</p>
        )}
      </Card>
    </main>
  );
}
