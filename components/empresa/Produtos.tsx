"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { describeRule } from "@/lib/comissao";
import { useEmpresa } from "@/components/empresa/EmpresaContext";

export type ProdutoRow = {
  id: string; name: string; description: string | null; commission_fixed_cents: number | null; commission_percent_bps: number | null;
  commission_cap_cents: number | null; grace_days: number; active: boolean; rule_version: number;
  referrals_count: number; sales_count: number; open_count: number;
};
export const regraDe = (p: ProdutoRow) => ({ fixedCents: p.commission_fixed_cents, percentBps: p.commission_percent_bps, capCents: p.commission_cap_cents });

export function Produtos() {
  const { empresa } = useEmpresa();
  const [lista, setLista] = useState<ProdutoRow[] | null>(null);

  useEffect(() => {
    let vivo = true;
    supabaseBrowser().from("company_offers").select("*").eq("company_id", empresa.id).order("active", { ascending: false }).order("name")
      .then(({ data }) => { if (vivo) setLista((data ?? []) as ProdutoRow[]); });
    return () => { vivo = false; };
  }, [empresa.id]);

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="O que os indicadores podem indicar, cada um com a sua regra de comissão."
        action={empresa.can_edit ? (
          <Link href="/empresa/produtos/novo" className="inline-flex min-h-11 items-center gap-2 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90">
            <Plus size={16} aria-hidden /> Novo produto
          </Link>
        ) : undefined}
      />
      {lista === null && <p role="status" className="text-sm text-muted">Carregando…</p>}
      {lista?.length === 0 && (
        <Card className="text-center">
          <h2 className="font-semibold">Nenhum produto cadastrado</h2>
          <p className="mt-1 text-sm text-muted">Cadastre o primeiro produto e defina quanto o indicador ganha por venda fechada.</p>
          {empresa.can_edit && <Link href="/empresa/produtos/novo" className="mt-4 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg">Cadastrar produto</Link>}
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {lista?.map((o) => (
          <Card key={o.id} className={o.active ? "" : "opacity-70"}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{o.name}</h2>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${o.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{o.active ? "Ativo" : "Pausado"}</span>
            </div>
            {o.description && <p className="mt-1 text-sm text-muted">{o.description}</p>}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-muted">Comissão</dt><dd className="font-medium">{describeRule(regraDe(o))}</dd></div>
              <div><dt className="text-xs text-muted">Carência</dt><dd className="font-medium">{o.grace_days} dias</dd></div>
              <div><dt className="text-xs text-muted">Indicações → vendas</dt><dd className="font-medium tabular-nums">{o.referrals_count} → {o.sales_count}</dd></div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <span className="text-muted">Regra na versão {o.rule_version}{o.open_count > 0 ? ` · ${o.open_count} em andamento` : ""}</span>
              {empresa.can_edit && (
                <Link href={`/empresa/produtos/${o.id}`} className="inline-flex items-center gap-1 font-medium text-brand underline"><Pencil size={14} aria-hidden /> Editar</Link>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
