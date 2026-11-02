"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, PageHeader, SaveNote } from "@/components/ui";
import { Toggle } from "@/components/Toggle";
import { INFORMES, TAX_RULES, type TaxRule } from "@/lib/plataforma";
import { brl, parsePercentBps, parseMoney } from "@/lib/comissao";

const inp = "rounded-brand border border-line bg-white px-2 py-1.5 text-sm tabular-nums";

export default function FiscalAdmin() {
  const [rules, setRules] = useState<TaxRule[]>(TAX_RULES);
  const [requireCpf, setRequireCpf] = useState(false);
  const [requireRepasse, setRequireRepasse] = useState(true);
  const [issuer, setIssuer] = useState({ name: "", cnpj: "" });
  const [year, setYear] = useState(2026);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const edit = (code: string, patch: Partial<TaxRule>) => { setRules((r) => r.map((x) => (x.code === code ? { ...x, ...patch } : x))); setSaved(true); };

  return (
    <>
      <PageHeader title="Fiscal" subtitle="Retenções, dados da empresa emissora e informe de rendimentos dos indicadores." />
      <Card className="border-amber-300 bg-amber-50">
        <p className="flex gap-2 text-sm text-amber-950"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span><strong>Definir com o contador antes de cobrar de verdade.</strong> As retenções abaixo estão desativadas e zeradas. O imposto de renda sobre comissão usa tabela progressiva mensal e o INSS tem teto e regras próprias; uma alíquota fixa é só um ponto de partida. Como o Indiki+ paga o indicador, ele é a fonte pagadora: retém, emite o informe e informa a Receita.</span></p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Empresa emissora (aparece no recibo e no informe)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Razão social<input className={`${inp} mt-1 w-full`} value={issuer.name} onChange={(e) => { setIssuer({ ...issuer, name: e.target.value }); setSaved(true); }} placeholder="Ainda em branco" /></label>
          <label className="text-sm font-medium">CNPJ<input className={`${inp} mt-1 w-full`} value={issuer.cnpj} onChange={(e) => { setIssuer({ ...issuer, cnpj: e.target.value }); setSaved(true); }} placeholder="00.000.000/0000-00" /></label>
        </div>
      </Card>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="p-4 text-left text-lg font-semibold">Regras de retenção</caption>
          <thead className="bg-surface text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Regra</th><th className="px-4 py-2 font-medium">Alíquota (%)</th><th className="px-4 py-2 font-medium">Base mínima (R$)</th><th className="px-4 py-2 font-medium">Ativa</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rules.map((r) => (
              <tr key={r.code} className={r.active ? "" : "opacity-70"}>
                <td className="px-4 py-3"><p className="font-medium">{r.kind}</p><p className="text-xs text-muted">{r.description}</p><p className="text-xs text-amber-800">{r.note}</p></td>
                <td className="px-4 py-3"><input aria-label={`Alíquota ${r.kind}`} className={`${inp} w-24`} inputMode="decimal" defaultValue={(r.rateBps / 100).toString().replace(".", ",")} onChange={(e) => edit(r.code, { rateBps: parsePercentBps(e.target.value) ?? 0 })} /></td>
                <td className="px-4 py-3"><input aria-label={`Base mínima ${r.kind}`} className={`${inp} w-28`} inputMode="decimal" defaultValue={(r.minBaseCents / 100).toFixed(2).replace(".", ",")} onChange={(e) => edit(r.code, { minBaseCents: parseMoney(e.target.value) ?? 0 })} /></td>
                <td className="px-4 py-3"><Toggle on={r.active} onChange={(v) => edit(r.code, { active: v })} label={`Regra ${r.kind} ativa`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Regras do pagamento</h2>
        <div className="flex items-start justify-between gap-4">
          <div><p className="font-medium">Exigir CPF para pagar o indicador</p><p className="text-sm text-muted">Ligado, quem não cadastrou o CPF não recebe até cadastrar.</p></div>
          <Toggle on={requireCpf} onChange={(v) => { setRequireCpf(v); setSaved(true); }} label="Exigir CPF para pagar" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div><p className="font-medium">Só pagar o indicador depois do repasse da empresa</p><p className="text-sm text-muted">Evita o Indiki+ pagar com dinheiro próprio uma comissão que a empresa ainda não repassou.</p></div>
          <Toggle on={requireRepasse} onChange={(v) => { setRequireRepasse(v); setSaved(true); }} label="Exigir repasse antes de pagar" />
        </div>
        <SaveNote saved={saved} />
      </Card>

      <Card className="mt-6 overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="text-lg font-semibold">Informes de rendimentos</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm">Ano <select className={inp} value={year} onChange={(e) => setYear(+e.target.value)}><option>2026</option><option>2025</option></select></label>
            <button onClick={() => setMsg(`Informes de ${year} gerados (exemplo). Se um valor ou o CPF mudar depois, nasce uma nova versão e a anterior fica guardada.`)} className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Gerar informes</button>
          </div>
        </div>
        {msg && <p role="status" className="mx-4 mb-3 rounded-brand bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</p>}
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Informe</th><th className="px-4 py-2 font-medium">Beneficiário</th><th className="px-4 py-2 font-medium">CPF</th><th className="px-4 py-2 text-right font-medium">Bruto</th><th className="px-4 py-2 text-right font-medium">IRRF</th><th className="px-4 py-2 text-right font-medium">INSS</th></tr></thead>
          <tbody className="divide-y divide-line">
            {INFORMES.filter((i) => i.year === year).map((i) => (
              <tr key={i.number}>
                <td className="px-4 py-2">{i.number} <span className="text-xs text-muted">v{i.version}</span></td>
                <td className="px-4 py-2">{i.beneficiary}</td>
                <td className="px-4 py-2">{i.cpf ?? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">CPF pendente</span>}</td>
                <td className="px-4 py-2 text-right tabular-nums">{brl(i.grossCents)}</td><td className="px-4 py-2 text-right tabular-nums">{brl(i.irrfCents)}</td><td className="px-4 py-2 text-right tabular-nums">{brl(i.inssCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="p-4 pt-2 text-xs text-muted">A DIRF acabou em 2025. As retenções passam a ser informadas ao eSocial e à EFD-Reinf, mas o informe ao beneficiário continua obrigatório. O contador confirma prazos e formato.</p>
      </Card>
    </>
  );
}
