import Link from "next/link";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { brl, commissions, offerName, offers, PILOT_COMPANY, sales, shortDate } from "@/lib/mock";

export const metadata = { title: "Visão geral" };

export default function EmpresaHome() {
  const totalReferrals = offers.reduce((s, o) => s + o.referrals, 0);
  const salesValue = sales.reduce((s, v) => s + v.valueCents, 0);
  const toPay = commissions
    .filter((c) => c.status === "liberada")
    .reduce((s, c) => s + c.amountCents, 0);
  const paid = commissions
    .filter((c) => c.status === "paga")
    .reduce((s, c) => s + c.amountCents, 0);
  const disputes = commissions.filter((c) => c.status === "contestada").length;

  const ranking = Object.entries(
    sales.reduce<Record<string, number>>((acc, v) => {
      acc[v.referrer] = (acc[v.referrer] ?? 0) + v.valueCents;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={`Indicações, vendas e comissões da ${PILOT_COMPANY}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Indicações recebidas" value={String(totalReferrals)} hint="todas as ofertas" />
        <StatCard label="Vendas geradas" value={brl(salesValue)} hint={`${sales.length} vendas`} tone="brand" />
        <StatCard label="Comissões a pagar" value={brl(toPay)} hint="já liberadas" tone="warn" />
        <StatCard label="Comissões pagas" value={brl(paid)} hint="confirmadas ou com comprovante" />
      </div>

      <div className="mt-4 rounded-brand border border-dashed border-line bg-white px-4 py-3 text-sm text-muted">
        <strong className="text-ink">Taxa do Indique Mais:</strong> a definir com o cliente
        (mensalidade, percentual sobre a comissão ou os dois). Quando definida, aparece aqui
        como o que a empresa deve à plataforma.
      </div>

      {disputes > 0 && (
        <Link
          href="/empresa/comissoes"
          className="mt-4 block rounded-brand border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          Você tem <strong>{disputes} comissão contestada</strong>. Toque para ver e responder.
        </Link>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Vendas recentes</h2>
            <Link href="/empresa/vendas" className="text-sm font-medium text-brand">
              Ver todas
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {sales.slice(0, 5).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{offerName(v.offerId)}</p>
                  <p className="truncate text-xs text-muted">
                    {shortDate(v.date)} · indicada por {v.referrer}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{brl(v.valueCents)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Quem mais vende por você</h2>
          <ol className="space-y-3">
            {ranking.map(([name, value], i) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{name}</span>
                <span className="tabular-nums text-muted">{brl(value)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
