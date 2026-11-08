"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEmpresa } from "@/components/empresa/EmpresaContext";
import { ConviteCard } from "@/components/empresa/ConviteCard";

type Plano = { plan_name: string; max_active_referrers: number | null; max_offers: number | null; used_referrers: number; used_offers: number };

export function Inicio() {
  const { empresa } = useEmpresa();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [n, setN] = useState<{ indicadores: number; produtos: number; abertas: number; pedidos: number } | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    let vivo = true;
    (async () => {
      const [{ data: p }, { count: ind }, { count: prod }, { count: ab }, { count: ped }] = await Promise.all([
        sb.from("company_current_plan").select("plan_name, max_active_referrers, max_offers, used_referrers, used_offers").eq("company_id", empresa.id).maybeSingle(),
        sb.from("company_indicators").select("id", { count: "exact", head: true }).eq("company_id", empresa.id).eq("active", true),
        sb.from("company_offers").select("id", { count: "exact", head: true }).eq("company_id", empresa.id).eq("active", true),
        sb.from("company_referrals").select("id", { count: "exact", head: true }).eq("company_id", empresa.id).in("stage", ["indicado", "orcamento", "fechou", "instalada"]),
        sb.from("company_indicators").select("id", { count: "exact", head: true }).eq("company_id", empresa.id).eq("request_status", "pendente"),
      ]);
      if (!vivo) return;
      setPlano(p as Plano | null);
      setN({ indicadores: ind ?? 0, produtos: prod ?? 0, abertas: ab ?? 0, pedidos: ped ?? 0 });
    })();
    return () => { vivo = false; };
  }, [empresa.id]);

  const passos = [
    { ok: Boolean(empresa.finance_email), label: "Completar os dados da empresa (e-mail financeiro e endereço)", href: "/empresa/dados" },
    { ok: (n?.produtos ?? 0) > 0, label: "Cadastrar o primeiro produto com a regra de comissão", href: "/empresa/produtos/novo" },
    { ok: (n?.indicadores ?? 0) > 0, label: "Convidar os primeiros indicadores", href: "/empresa/indicadores" },
  ];
  const limite = (usado?: number, max?: number | null) => (max == null ? `${usado ?? "…"}` : `${usado ?? "…"} de ${max}`);

  return (
    <>
      <PageHeader title={`Olá, ${empresa.name}`} subtitle={plano ? `Plano ${plano.plan_name}` : undefined} />
      {(n?.pedidos ?? 0) > 0 && (
        <Link href="/empresa/indicadores" className="mb-4 block rounded-brand border-2 border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          {n!.pedidos === 1 ? "1 pessoa pediu" : `${n!.pedidos} pessoas pediram`} para indicar a sua empresa. Ver e responder.
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-muted">Indicadores ativos</p><p className="mt-1 text-3xl font-semibold tabular-nums">{limite(n?.indicadores, plano?.max_active_referrers)}</p></Card>
        <Card><p className="text-sm text-muted">Produtos ativos</p><p className="mt-1 text-3xl font-semibold tabular-nums">{limite(n?.produtos, plano?.max_offers)}</p></Card>
        <Link href="/empresa/indicacoes" className="rounded-brand border border-line bg-white p-5 hover:border-brand"><p className="text-sm text-muted">Indicações em andamento</p><p className="mt-1 text-3xl font-semibold tabular-nums">{n?.abertas ?? "…"}</p></Link>
      </div>

      {n && passos.some((p) => !p.ok) && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Primeiros passos</h2>
          <ol className="mt-3 space-y-2">
            {passos.map((p) => (
              <li key={p.href} className="flex items-start gap-3 text-sm">
                {p.ok ? <CheckCircle2 size={20} className="shrink-0 text-emerald-600" aria-label="Feito" /> : <Circle size={20} className="shrink-0 text-muted" aria-label="A fazer" />}
                {p.ok ? <span className="text-muted line-through">{p.label}</span> : <Link href={p.href} className="font-medium text-brand underline">{p.label}</Link>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mt-6">
        <ConviteCard companyId={empresa.id} companyName={empresa.name} canEdit={empresa.can_edit} />
      </div>
    </>
  );
}
