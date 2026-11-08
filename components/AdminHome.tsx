"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { brl } from "@/lib/comissao";
import { ETAPA, ETAPAS_ORDEM } from "@/lib/rotulos";

type Geral = Record<string, number>;
type PorEmpresa = { id: string; name: string; status: string; plan_name: string | null; members_count: number; offers_count: number; indicators_count: number;
  referrals_count: number; open_count: number; sales_count: number; sales_cents: number; commissions_cents: number };

/** Visão geral do Indiki+: números de todas as empresas, funil das indicações e comparação por empresa. */
export function AdminHome() {
  const [g, setG] = useState<Geral | null>(null);
  const [emp, setEmp] = useState<PorEmpresa[] | null>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = supabaseBrowser();
    sb.from("admin_overview").select("*").maybeSingle().then(({ data }) => setG((data as Geral) ?? {}));
    sb.from("admin_company_summary").select("*").order("referrals_count", { ascending: false }).then(({ data }) => setEmp((data ?? []) as PorEmpresa[]));
  }, []);

  const n = (k: string) => (g ? Number(g[k] ?? 0) : null);
  const kpis: [string, string, string, string?][] = [
    ["Empresas ativas", fmt(n("companies_active")), "/admin/empresas", n("companies_suspended") ? `${n("companies_suspended")} suspensa(s)` : undefined],
    ["Indicadores ativos", fmt(n("indicators_active")), "/admin/indicadores", n("indicators_incomplete") ? `${n("indicators_incomplete")} sem cadastro completo` : undefined],
    ["Produtos ativos", fmt(n("offers_active")), "/admin/produtos"],
    ["Indicações", fmt(n("referrals_total")), "/admin/indicacoes"],
  ];
  const dinheiro: [string, number | null, string][] = [
    ["Vendido por indicação", n("sales_cents"), "text-ink"],
    ["Comissão em carência", n("commissions_pending_cents"), "text-amber-700"],
    ["Comissão liberada para pagar", n("commissions_released_cents"), "text-sky-700"],
    ["Comissão já paga", n("commissions_paid_cents"), "text-emerald-700"],
  ];
  const total = Math.max(1, n("referrals_total") ?? 0);

  return (
    <>
      <PageHeader title="Visão geral" subtitle="Tudo o que acontece em todas as empresas do Indiki+." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([l, v, href, extra]) => (
          <Link key={l} href={href} className="rounded-brand border border-line bg-white p-4 hover:border-brand">
            <p className="text-sm text-muted">{l}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{v}</p>
            {extra && <p className="mt-1 text-xs text-amber-700">{extra}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <h2 className="font-semibold">Funil das indicações</h2>
          <p className="text-sm text-muted">Em que etapa está cada indicação hoje.</p>
          <ul className="mt-4 space-y-3">
            {ETAPAS_ORDEM.map((s) => {
              const v = n(`stage_${s}`) ?? 0;
              return (
                <li key={s}>
                  <Link href={`/admin/indicacoes?etapa=${s}`} className="group block">
                    <div className="flex justify-between text-sm"><span className="group-hover:underline">{ETAPA[s].label}</span><span className="tabular-nums font-medium">{g ? v : "…"}</span></div>
                    <div className="mt-1 h-3 rounded-full bg-surface"><div className={`h-3 rounded-full ${ETAPA[s].bar}`} style={{ width: `${(v / total) * 100}%` }} /></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Dinheiro</h2>
          <dl className="mt-3 divide-y divide-line">
            {dinheiro.map(([l, v, c]) => (
              <div key={l} className="flex items-baseline justify-between gap-3 py-3">
                <dt className="text-sm text-muted">{l}</dt>
                <dd className={`text-xl font-semibold tabular-nums ${c}`}>{v == null ? "…" : brl(v)}</dd>
              </div>
            ))}
          </dl>
          <Link href="/admin/comissoes" className="mt-2 inline-block text-sm font-medium text-brand underline">Ver comissões</Link>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Por empresa</h2>
      {emp === null && <p role="status" className="text-sm text-muted">Carregando…</p>}
      {emp && emp.length === 0 && <Card className="text-sm text-muted">Nenhuma empresa ainda.</Card>}
      {emp && emp.length > 0 && (
        <div className="min-w-0 overflow-x-auto rounded-brand border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs text-muted">
              <tr>{["Empresa", "Plano", "Acessos", "Produtos", "Indicadores", "Indicações (em andamento)", "Vendas", "Vendido", "Comissões"].map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {emp.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-3"><Link href={`/admin/empresas/${e.id}`} className="font-medium text-brand underline">{e.name}</Link>{e.status !== "ativa" && <span className="ml-2 text-xs text-rose-700">suspensa</span>}</td>
                  <td className="px-3 py-3">{e.plan_name ?? "—"}</td>
                  <td className={`px-3 py-3 tabular-nums ${e.members_count === 0 ? "font-medium text-amber-700" : ""}`}>{e.members_count}</td>
                  <td className="px-3 py-3 tabular-nums">{e.offers_count}</td>
                  <td className="px-3 py-3 tabular-nums">{e.indicators_count}</td>
                  <td className="px-3 py-3 tabular-nums">{e.referrals_count} ({e.open_count})</td>
                  <td className="px-3 py-3 tabular-nums">{e.sales_count}</td>
                  <td className="px-3 py-3 tabular-nums">{brl(e.sales_cents)}</td>
                  <td className="px-3 py-3 tabular-nums">{brl(e.commissions_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const fmt = (v: number | null) => (v == null ? "…" : String(v));
