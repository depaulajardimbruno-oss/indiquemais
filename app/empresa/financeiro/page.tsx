import Link from "next/link";
import { Card, PageHeader, Pill, StatCard } from "@/components/ui";
import { INVOICES, KIND_LABEL } from "@/lib/plataforma";
import { brl } from "@/lib/comissao";

export const metadata = { title: "Financeiro" };

const MINE = INVOICES.filter((i) => i.companyId === "soulglass");

export default function FinanceiroPage() {
  const aPagar = MINE.filter((i) => i.status === "aberta" || i.status === "vencida").reduce((s, i) => s + i.amountCents, 0);
  const fees = MINE.filter((i) => i.status === "paga" && i.kind !== "repasse_comissoes").reduce((s, i) => s + i.amountCents, 0);
  const repasse = MINE.filter((i) => i.status === "paga" && i.kind === "repasse_comissoes").reduce((s, i) => s + i.amountCents, 0);
  return (
    <>
      <PageHeader title="Financeiro" subtitle="O que você paga ao Indiki+: mensalidade, taxa sobre vendas e o repasse das comissões dos seus indicadores." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="A pagar" value={brl(aPagar)} tone="warn" hint="Faturas em aberto" />
        <StatCard label="Pago em 2026: mensalidade e taxas" value={brl(fees)} tone="brand" />
        <StatCard label="Pago em 2026: repasse de comissões" value={brl(repasse)} hint="O Indiki+ paga os indicadores" />
      </div>

      <Card className="mt-6 bg-brand-soft text-sm">
        <p><strong>Como funciona:</strong> quando uma comissão é liberada, o Indiki+ cobra o valor dela de você junto com a taxa. Você paga, o Indiki+ confirma e o recibo aparece aqui. No fim do mês, o Indiki+ paga os indicadores. O repasse não é uma taxa: é o dinheiro que vai para quem indicou.</p>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Faturas</h2>
      <ul className="space-y-3">
        {MINE.map((i) => (
          <li key={i.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{KIND_LABEL[i.kind]} <span className="font-normal text-muted">· {i.period}</span></p>
                  <p className="text-sm text-muted">{i.number} · vence em {i.due}{i.paidAt ? ` · pago em ${i.paidAt}` : ""}</p>
                  {i.note && i.status === "paga" && <p className="text-xs text-muted">Nota fiscal: {i.note}</p>}
                </div>
                <div className="text-right"><p className="text-lg font-semibold tabular-nums">{brl(i.amountCents)}</p><Pill status={i.status} /></div>
              </div>
              {i.items && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-brand">Ver o que compõe</summary>
                  <ul className="mt-2 divide-y divide-line rounded-brand border border-line">
                    {i.items.map((it) => (
                      <li key={it.description} className="flex justify-between gap-3 px-3 py-2"><span>{it.description}{it.baseCents ? <span className="text-muted"> · base {brl(it.baseCents)}{it.feeBps ? ` × ${it.feeBps / 100}%` : ""}</span> : null}</span><span className="tabular-nums">{brl(it.amountCents)}</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {i.receipt && <p className="mt-3 text-sm"><Link className="font-medium text-brand underline" href={`/empresa/financeiro/recibo/${i.receipt}`}>Ver recibo {i.receipt}</Link></p>}
              {(i.status === "aberta" || i.status === "vencida") && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">Pague por Pix ou transferência e avise o Indiki+. Dados para pagamento: a definir. O recibo sai assim que o pagamento for confirmado.</p>}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
