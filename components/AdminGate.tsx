"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";

type State = "carregando" | "sem-login" | "sem-permissao" | "ok" | "prototipo";

/** Só deixa ver o painel quem entrou e é administrador do Indiki+. A decisão final é do banco (RLS):
 *  mesmo que alguém burle esta tela, as consultas voltam vazias. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(hasSupabase ? "carregando" : "prototipo");
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) return setState("sem-login");
      setEmail(data.session.user.email ?? "");
      const { data: isAdmin, error } = await sb.rpc("is_platform_admin");
      setState(!error && isAdmin === true ? "ok" : "sem-permissao");
    })();
  }, []);

  if (state === "ok" || state === "prototipo") return <>{children}</>;
  if (state === "carregando") return <p className="p-8 text-sm text-muted" role="status">Conferindo seu acesso…</p>;

  return (
    <Card className="mx-auto mt-8 max-w-md">
      {state === "sem-login" ? (
        <>
          <h1 className="text-xl font-semibold">Entre para acessar a administração</h1>
          <p className="mt-1 text-sm text-muted">Esta área é só para a equipe do Indiki+. Enviamos um link de acesso para o seu e-mail.</p>
          <Link href="/entrar?destino=/admin" className="mt-4 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg">Entrar</Link>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Sem acesso de administrador</h1>
          <p className="mt-1 text-sm text-muted">A conta {email} não é administradora do Indiki+. Entre com o e-mail autorizado.</p>
          <button
            onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/entrar?destino=/admin"); }}
            className="mt-4 rounded-brand border border-brand px-4 py-2 text-sm font-medium text-brand"
          >Sair e trocar de conta</button>
        </>
      )}
    </Card>
  );
}
