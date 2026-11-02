import { Card, PageHeader, SourceBadge } from "@/components/ui";
import { brl, offerName, sales, shortDate } from "@/lib/mock";

export const metadata = { title: "Vendas" };

export default function VendasPage() {
  const total = sales.reduce((s, v) => s + v.valueCents, 0);
  const manual = sales.filter((v) => v.source === "manual").length;

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle={`${sales.length} vendas · ${brl(total)} · ${manual} lançadas manualmente`}
      />

      <Card className="mb-4 bg-brand-soft text-sm">
        <p>
          <strong>Como as vendas entram:</strong> automaticamente, quando seu sistema avisa o
          Indique Mais (API), ou manualmente, quando você lança no painel. Venda automática é
          mais rápida e gera menos disputa.
        </p>
      </Card>

      {/* Tabela no desktop */}
      <div className="hidden overflow-hidden rounded-brand border border-line bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Oferta</th>
              <th className="px-4 py-3 font-medium">Indicador</th>
              <th className="px-4 py-3 font-medium">Comprador</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sales.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 whitespace-nowrap">{shortDate(v.date)}</td>
                <td className="px-4 py-3">{offerName(v.offerId)}</td>
                <td className="px-4 py-3">{v.referrer}</td>
                <td className="px-4 py-3 text-muted">{v.buyer}</td>
                <td className="px-4 py-3"><SourceBadge source={v.source} /></td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{brl(v.valueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões no celular */}
      <ul className="space-y-3 md:hidden">
        {sales.map((v) => (
          <li key={v.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{offerName(v.offerId)}</p>
                <p className="shrink-0 font-semibold tabular-nums">{brl(v.valueCents)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {shortDate(v.date)} · {v.referrer} · {v.buyer}
              </p>
              <div className="mt-2"><SourceBadge source={v.source} /></div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
