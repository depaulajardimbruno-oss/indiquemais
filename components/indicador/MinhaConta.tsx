"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { SignOutButton } from "@/components/SignOutButton";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { dataBR } from "@/lib/rotulos";
import { Compartilhar, PainelIndicador } from "@/components/indicador/PainelIndicador";

type Vinculo = { id: string; company_id: string; company_name: string; code: string; request_status: string; active: boolean; requested_at: string | null; decided_at: string | null; decision_note: string | null; archived: boolean };

export function MinhaConta() {
  const origin = useOrigin();
  const [estado, setEstado] = useState<"carregando" | "fora" | "ok">(hasSupabase ? "carregando" : "fora");
  const [email, setEmail] = useState("");
  const [completo, setCompleto] = useState(false);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [atalhos, setAtalhos] = useState<{ admin: boolean; empresa: boolean }>({ admin: false, empresa: false });

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = supabaseBrowser();
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return setEstado("fora");
      setEmail(s.session.user.email ?? "");
      const [{ data: me }, { data: v }, { data: adm }, { count }] = await Promise.all([
        sb.from("indicator_my_profile").select("completed").maybeSingle(),
        sb.from("indicator_my_companies").select("*").order("requested_at", { ascending: false, nullsFirst: false }),
        sb.rpc("is_platform_admin"),
        sb.from("company_my_companies").select("id", { count: "exact", head: true }),
      ]);
      setCompleto(Boolean(me?.completed));
      setVinculos((v ?? []) as Vinculo[]);
      setAtalhos({ admin: adm === true, empresa: (count ?? 0) > 0 });
      setEstado("ok");
    })();
  }, []);

  if (estado === "carregando") return <Card><p role="status" className="text-sm text-muted">Abrindo…</p></Card>;
  if (estado === "fora") return (
    <Card className="text-center">
      <h1 className="text-xl font-semibold">Entre para ver sua conta</h1>
      <Link href="/entrar?destino=/conta" className="mt-4 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg">Entrar</Link>
    </Card>
  );

  const situ = (v: Vinculo) =>
    v.request_status === "pendente" ? ["Aguardando a empresa", "bg-amber-100 text-amber-800"]
    : v.request_status === "recusado" ? ["Recusado", "bg-rose-100 text-rose-800"]
    : v.active ? ["Ativo", "bg-emerald-100 text-emerald-800"] : ["Pausado pela empresa", "bg-slate-100 text-slate-600"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
          <p className="text-sm text-muted">{email}</p>
        </div>
        <SignOutButton />
      </div>
      {(atalhos.admin || atalhos.empresa) && (
        <Card className="flex flex-wrap gap-3">
          {atalhos.admin && <Link href="/admin" className="rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg">Painel do Indiki+</Link>}
          {atalhos.empresa && <Link href="/empresa" className="rounded-brand border border-line px-4 py-2 text-sm font-semibold">Painel da empresa</Link>}
        </Card>
      )}
      {!completo && (
        <Card className="border-2 border-accent">
          <h2 className="font-semibold">Complete o seu cadastro</h2>
          <p className="mt-1 text-sm text-muted">Para indicar e receber comissões precisamos do CPF, da chave PIX e de alguns dados seus.</p>
          <Link href="/cadastro" className="mt-3 inline-block rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg">Completar cadastro</Link>
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Empresas que você indica</h2>
          <Link href="/cadastro" className="inline-flex items-center gap-1 text-sm font-medium text-brand underline"><Plus size={14} aria-hidden /> Indicar outras empresas</Link>
        </div>
        {vinculos.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma ainda. Escolha empresas para indicar ou use o link de convite que uma empresa te mandou.</p>}
        <ul className="mt-2 divide-y divide-line">
          {vinculos.map((v) => {
            const [t, c] = situ(v);
            const ok = v.active && v.request_status === "aprovado";
            return (
              <li key={v.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{v.company_name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{t}</span>
                </div>
                {ok && (
                  <div className="mt-2">
                    <p className="truncate font-mono text-xs text-muted">{origin}/i/{v.code}</p>
                    <Compartilhar empresa={v.company_name} link={`${origin}/i/${v.code}`} />
                  </div>
                )}
                {v.request_status === "pendente" && <p className="mt-1 text-xs text-muted">Pedido enviado em {dataBR(v.requested_at)}.</p>}
                {v.request_status === "recusado" && <p className="mt-1 text-xs text-muted">Respondido em {dataBR(v.decided_at)}{v.decision_note ? `: ${v.decision_note}` : "."}</p>}
              </li>
            );
          })}
        </ul>
      </Card>
      {completo && <PainelIndicador temVinculo={vinculos.some((v) => v.active)} />}
    </div>
  );
}
