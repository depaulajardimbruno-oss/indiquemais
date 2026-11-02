import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { offers } from "@/lib/mock";
import { describeRule } from "@/lib/comissao";

export const metadata = { title: "Produtos" };

export default function OfertasPage() {
  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Serviços que os indicadores podem divulgar, cada um com a sua regra de comissão."
        action={
          <Link
            href="/empresa/ofertas/nova"
            className="inline-flex items-center gap-2 rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg hover:opacity-90"
          >
            <Plus size={16} aria-hidden /> Novo produto
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {offers.map((o) => (
          <Card key={o.id} className={o.active ? "" : "opacity-60"}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{o.name}</h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  o.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {o.active ? "Ativa" : "Encerrada"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{o.description}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Comissão</dt>
                <dd className="font-medium">{describeRule(o.rule)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Carência</dt>
                <dd className="font-medium">{o.graceDays} dias</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Indicações → vendas</dt>
                <dd className="font-medium tabular-nums">
                  {o.referrals} → {o.sales}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
