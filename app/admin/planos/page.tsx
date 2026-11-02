"use client";

import { useState } from "react";
import { Card, PageHeader, SaveNote } from "@/components/ui";
import { Toggle } from "@/components/Toggle";
import { PLANS, REPORT_LABEL, SUPPORT_LABEL, type Plan } from "@/lib/plataforma";
import { parseMoney, parsePercentBps } from "@/lib/comissao";

const inp = "w-full rounded-brand border border-line bg-white px-2 py-1.5 text-sm tabular-nums";

export default function PlanosAdmin() {
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [saved, setSaved] = useState(false);
  const edit = (code: string, patch: Partial<Plan>) => { setPlans((p) => p.map((x) => (x.code === code ? { ...x, ...patch } : x))); setSaved(true); };
  const limit = (v: string) => (v.trim() === "" ? null : Math.max(1, parseInt(v, 10) || 1));

  const rows: { label: string; hint?: string; cell: (p: Plan) => React.ReactNode }[] = [
    { label: "Preço mensal (R$)", hint: "Vazio = a definir", cell: (p) => (
      <input className={inp} inputMode="decimal" placeholder="a definir" defaultValue={p.priceCents != null ? (p.priceCents / 100).toFixed(2).replace(".", ",") : ""}
        onChange={(e) => edit(p.code, { priceCents: e.target.value.trim() === "" ? null : parseMoney(e.target.value) })} />) },
    { label: "Taxa sobre cada venda (%)", hint: "Cobrada da empresa, por cima da comissão", cell: (p) => (
      <input className={inp} inputMode="decimal" defaultValue={(p.feeBps / 100).toString().replace(".", ",")}
        onChange={(e) => edit(p.code, { feeBps: parsePercentBps(e.target.value) ?? p.feeBps })} />) },
    { label: "Indicadores ativos", hint: "Vazio = ilimitado", cell: (p) => (
      <input className={inp} inputMode="numeric" placeholder="ilimitado" defaultValue={p.maxReferrers ?? ""} onChange={(e) => edit(p.code, { maxReferrers: limit(e.target.value) })} />) },
    { label: "Produtos", hint: "Vazio = ilimitado", cell: (p) => (
      <input className={inp} inputMode="numeric" placeholder="ilimitado" defaultValue={p.maxOffers ?? ""} onChange={(e) => edit(p.code, { maxOffers: limit(e.target.value) })} />) },
    { label: "Usuários da empresa", hint: "Vazio = ilimitado", cell: (p) => (
      <input className={inp} inputMode="numeric" placeholder="ilimitado" defaultValue={p.maxMembers ?? ""} onChange={(e) => edit(p.code, { maxMembers: limit(e.target.value) })} />) },
    { label: "Relatórios", cell: (p) => (
      <select className={inp} value={p.report} onChange={(e) => edit(p.code, { report: e.target.value as Plan["report"] })}>
        {Object.entries(REPORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>) },
    { label: "Suporte", cell: (p) => (
      <select className={inp} value={p.support} onChange={(e) => edit(p.code, { support: e.target.value as Plan["support"] })}>
        {Object.entries(SUPPORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>) },
    { label: "Integração com o CRM", cell: (p) => <Toggle on={p.crm} onChange={(v) => edit(p.code, { crm: v })} label={`Integração com o CRM no plano ${p.name}`} /> },
    { label: "Destaque na vitrine", cell: (p) => <Toggle on={p.highlight} onChange={(v) => edit(p.code, { highlight: v })} label={`Destaque na vitrine no plano ${p.name}`} /> },
    { label: "Disponível para contratar", hint: "Desativado: ninguém novo entra, quem já tem continua", cell: (p) => <Toggle on={p.active} onChange={(v) => edit(p.code, { active: v })} label={`Plano ${p.name} disponível`} /> },
  ];

  return (
    <>
      <PageHeader title="Planos" subtitle="Todos os valores e limites ficam aqui. Mudou o número, mudou a regra: não precisa de programador." />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="w-64 px-4 py-3 text-left font-medium text-muted">Parâmetro</th>
              {plans.map((p) => (
                <th key={p.code} className={`px-3 py-3 text-left ${p.active ? "" : "opacity-60"}`}>
                  <p className="text-base font-semibold">{p.name}</p>
                  <p className="text-xs font-normal text-muted">{p.description}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="px-4 py-3 text-left align-top font-medium">
                  {r.label}
                  {r.hint && <span className="block text-xs font-normal text-muted">{r.hint}</span>}
                </th>
                {plans.map((p) => <td key={p.code} className="px-3 py-3 align-top">{r.cell(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 space-y-1 text-sm text-muted">
        <p>Os limites são travados no banco: a empresa que chega no máximo não consegue cadastrar mais, mesmo mexendo na tela.</p>
        <p>Mudar a taxa de um plano vale para as vendas futuras. A venda já fechada mantém a taxa do dia em que fechou.</p>
        <SaveNote saved={saved} />
      </div>
    </>
  );
}
