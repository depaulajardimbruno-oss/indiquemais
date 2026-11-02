"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Pill, StatCard } from "@/components/ui";
import { INVOICES, KIND_LABEL, type Invoice } from "@/lib/plataforma";
import { brl } from "@/lib/comissao";

const inp = "rounded-brand border border-line bg-white px-2 py-1.5 text-sm";
const METHODS = [["pix", "Pix"], ["boleto", "Boleto"], ["cartao", "Cartão"], ["transferencia", "Transferência"], ["outro", "Outro"]] as const;
type Tab = "faturas" | "repasses" | "recibos";

// Comissões liberadas que ainda não foram cobradas da empresa (exemplo)
const NOT_BILLED = [{ company: "Casa Nova Reformas", who: "Rafael Lima", contract: "CN-0071", amountCents: 25000 }];

export default function CobrancaAdmin() {
  const [tab, setTab] = useState<Tab>("faturas");
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);
  const [paying, setPaying] = useState<string | null>(null);
  const [method, setMethod] = useState("pix");
  const [ref, setRef] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const receiptSeq = useRef(3);

  const open = invoices.filter((i) => i.status === "aberta" || i.status === "vencida");
  const fees = (k: boolean) => (i: Invoice) => (i.kind === "repasse_comissoes") === k;
  const feesOpen = open.filter(fees(false)).reduce((s, i) => s + i.amountCents, 0);
  const repasseOpen = open.filter(fees(true)).reduce((s, i) => s + i.amountCents, 0);
  const overdue = invoices.filter((i) => i.status === "vencida").reduce((s, i) => s + i.amountCents, 0);

  function pay(i: Invoice) {
    receiptSeq.current += 1;
    const n = `R-2026-${String(receiptSeq.current).padStart(6, "0")}`;
    setInvoices((all) => all.map((x) => (x.id === i.id ? { ...x, status: "paga", paidAt: "02/11/2026", receipt: n } : x)));
    setMsg(`Pagamento registrado. Recibo ${n} emitido para ${i.company}.`);
    setPaying(null); setRef("");
  }
  function cancel(i: Invoice) {
    if (reason.trim().length < 5) return setErr("Informe o motivo do cancelamento (mínimo 5 letras).");
    setInvoices((all) => all.map((x) => (x.id === i.id ? { ...x, status: "cancelada", note: reason.trim() } : x)));
    setMsg(`Fatura ${i.number} cancelada. As vendas e comissões dela voltam a poder ser cobradas.`);
    setCancelling(null); setReason(""); setErr(null);
  }

  return (
    <>
      <PageHeader
        title="Cobrança e repasses"
        subtitle="O que a empresa paga ao Indiki+: mensalidade, taxa sobre vendas e o repasse das comissões que vão para os indicadores."
        action={<button onClick={() => setMsg("Faturas do mês geradas (exemplo). No sistema real, nada é cobrado duas vezes: gerar de novo não duplica.")} className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90">Gerar faturas do mês</button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Receita a receber (mensalidades e taxas)" value={brl(feesOpen)} tone="brand" hint="Dinheiro do Indiki+" />
        <StatCard label="Repasse a receber (comissões)" value={brl(repasseOpen)} tone="warn" hint="Dinheiro de passagem: vai para os indicadores" />
        <StatCard label="Vencido" value={brl(overdue)} hint={overdue ? "Cobrar a empresa" : "Nada vencido"} />
      </div>
      {msg && <p role="status" className="mt-4 rounded-brand bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</p>}

      <div role="tablist" aria-label="Seções" className="mt-6 flex gap-1 border-b border-line">
        {([["faturas", "Faturas"], ["repasses", "Repasses pendentes"], ["recibos", "Recibos"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-brand text-brand" : "border-transparent text-muted"}`}>{l}</button>
        ))}
      </div>

      {tab === "faturas" && (
        <ul className="mt-4 space-y-3">
          {invoices.map((i) => (
            <li key={i.id}>
              <Card className={`p-4 ${i.status === "cancelada" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{i.company} <span className="font-normal text-muted">· {KIND_LABEL[i.kind]} · {i.period}</span></p>
                    <p className="text-sm text-muted">{i.number} · vence em {i.due}{i.paidAt ? ` · pago em ${i.paidAt}` : ""}{i.receipt ? ` · recibo ${i.receipt}` : ""}{i.note && i.status === "paga" ? ` · ${i.note}` : ""}</p>
                    {i.status === "cancelada" && i.note && <p className="text-sm text-muted">Motivo: {i.note}</p>}
                    {i.kind === "repasse_comissoes" && <p className="mt-1 text-xs text-muted">Dinheiro de passagem: não é receita do Indiki+.</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{brl(i.amountCents)}</p>
                    <Pill status={i.status} />
                  </div>
                </div>
                {i.items && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-brand">Ver o que compõe esta fatura</summary>
                    <ul className="mt-2 divide-y divide-line rounded-brand border border-line">
                      {i.items.map((it) => (
                        <li key={it.description} className="flex justify-between gap-3 px-3 py-2">
                          <span>{it.description}{it.baseCents ? <span className="text-muted"> · base {brl(it.baseCents)}{it.feeBps ? ` × ${it.feeBps / 100}%` : ""}</span> : null}</span>
                          <span className="tabular-nums">{brl(it.amountCents)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {(i.status === "aberta" || i.status === "vencida") && (
                  <div className="mt-3 border-t border-line pt-3">
                    {paying === i.id ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-sm">Forma<br /><select className={inp} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        <label className="text-sm">Código da transação (opcional)<br /><input className={inp} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
                        <button onClick={() => pay(i)} className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Confirmar pagamento e emitir recibo</button>
                        <button onClick={() => setPaying(null)} className="rounded-brand border border-line px-4 py-2 text-sm">Cancelar</button>
                      </div>
                    ) : cancelling === i.id ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-sm">Motivo do cancelamento<br /><input className={`${inp} w-72`} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                        <button onClick={() => cancel(i)} className="rounded-brand bg-rose-700 px-4 py-2 text-sm font-medium text-white">Cancelar fatura</button>
                        <button onClick={() => { setCancelling(null); setErr(null); }} className="rounded-brand border border-line px-4 py-2 text-sm">Voltar</button>
                        {err && <p role="alert" className="w-full text-sm text-red-700">{err}</p>}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setPaying(i.id)} className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Registrar pagamento</button>
                        <button onClick={() => setCancelling(i.id)} className="rounded-brand border border-line px-4 py-2 text-sm">Cancelar fatura</button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {tab === "repasses" && (
        <div className="mt-4 space-y-4">
          <Card>
            <h2 className="font-semibold">Como funciona o repasse</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>A comissão fica liberada (obra instalada + carência).</li>
              <li>O Indiki+ cobra o valor da comissão da empresa, junto com a taxa.</li>
              <li>A empresa paga e o recibo sai na hora.</li>
              <li>No fim do mês, o Indiki+ paga só as comissões que a empresa já repassou.</li>
            </ol>
          </Card>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="p-4 text-left text-lg font-semibold">Comissões liberadas esperando repasse</caption>
              <thead className="bg-surface text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Empresa</th><th className="px-4 py-2 font-medium">Indicador</th><th className="px-4 py-2 font-medium">Contrato</th><th className="px-4 py-2 font-medium">Situação</th><th className="px-4 py-2 text-right font-medium">Valor</th></tr></thead>
              <tbody className="divide-y divide-line">
                {invoices.filter((i) => i.kind === "repasse_comissoes" && i.status !== "paga" && i.status !== "cancelada").flatMap((i) => (i.items ?? []).map((it) => (
                  <tr key={i.id + it.description}><td className="px-4 py-2">{i.company}</td><td className="px-4 py-2">{it.description.split(", ")[2]}</td><td className="px-4 py-2">{it.description.split(", ")[1]?.replace("contrato ", "")}</td><td className="px-4 py-2"><Pill status="aberta" /> <span className="text-xs text-muted">fatura {i.number}</span></td><td className="px-4 py-2 text-right tabular-nums">{brl(it.amountCents)}</td></tr>
                )))}
                {NOT_BILLED.map((n) => (
                  <tr key={n.contract}><td className="px-4 py-2">{n.company}</td><td className="px-4 py-2">{n.who}</td><td className="px-4 py-2">{n.contract}</td><td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">Ainda não cobrada</span></td><td className="px-4 py-2 text-right tabular-nums">{brl(n.amountCents)}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "recibos" && (
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Recibo</th><th className="px-4 py-2 font-medium">Empresa</th><th className="px-4 py-2 font-medium">Referente a</th><th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 text-right font-medium">Valor</th></tr></thead>
            <tbody className="divide-y divide-line">
              {invoices.filter((i) => i.receipt).map((i) => (
                <tr key={i.receipt}>
                  <td className="px-4 py-2"><Link className="font-medium text-brand underline" href={`/empresa/financeiro/recibo/${i.receipt}`}>{i.receipt}</Link></td>
                  <td className="px-4 py-2">{i.company}</td><td className="px-4 py-2">{KIND_LABEL[i.kind]} {i.period}</td><td className="px-4 py-2">{i.paidAt}</td><td className="px-4 py-2 text-right tabular-nums">{brl(i.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-4 pt-2 text-xs text-muted">O recibo comprova o pagamento. Ele não substitui a nota fiscal de serviço: o número da nota é anexado à fatura.</p>
        </Card>
      )}
    </>
  );
}
