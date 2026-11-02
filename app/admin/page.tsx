import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { ADMIN_COMPANIES, INVOICES, PLANS, levelName } from "@/lib/plataforma";
import { brl } from "@/lib/comissao";

export const metadata = { title: "Visão geral" };

export default function AdminHome() {
  const receita = INVOICES.filter((i) => i.status === "paga" && i.kind !== "repasse_comissoes").reduce((s, i) => s + i.amountCents, 0);
  const repasseAberto = INVOICES.filter((i) => i.kind === "repasse_comissoes" && (i.status === "aberta" || i.status === "vencida")).reduce((s, i) => s + i.amountCents, 0);
  const vencidas = INVOICES.filter((i) => i.status === "vencida");
  const alerts = [
    { text: `${vencidas.length} fatura vencida: ${vencidas.map((v) => v.company).join(", ")}`, href: "/admin/cobranca" },
    { text: "1 comissão liberada ainda não cobrada da empresa", href: "/admin/cobranca" },
    { text: "1 indicador recebeu comissão e ainda não tem CPF cadastrado", href: "/admin/fiscal" },
    { text: "Dados da empresa emissora (razão social e CNPJ) ainda em branco", href: "/admin/fiscal" },
  ];
  return (
    <>
      <PageHeader title="Visão geral" subtitle="Receita do Indiki+, dinheiro de passagem e o que precisa da sua atenção." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receita recebida (mensalidades e taxas)" value={brl(receita)} tone="brand" hint="Só o que é do Indiki+" />
        <StatCard label="Repasses a receber das empresas" value={brl(repasseAberto)} tone="warn" hint="Dinheiro de passagem: vai para os indicadores" />
        <StatCard label="Empresas ativas" value={String(ADMIN_COMPANIES.length)} />
        <StatCard label="Planos em oferta" value={String(PLANS.filter((p) => p.active).length)} hint="de 4 cadastrados" />
      </div>

      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle size={18} className="text-accent" aria-hidden /> Precisa de atenção</h2>
        <ul className="mt-3 divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.text}>
              <Link href={a.href} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-brand">
                {a.text}
                <ArrowRight size={16} aria-hidden className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="p-4 text-left text-lg font-semibold">Empresas</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr><th className="px-4 py-2 font-medium">Empresa</th><th className="px-4 py-2 font-medium">Plano</th><th className="px-4 py-2 font-medium">Selo</th><th className="px-4 py-2 font-medium">Indicadores</th><th className="px-4 py-2 font-medium">Vendas</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ADMIN_COMPANIES.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{PLANS.find((p) => p.code === c.plan)?.name}</td>
                <td className="px-4 py-3">{c.seal ? levelName(c.seal) : <span className="text-muted">sem selo</span>}</td>
                <td className="px-4 py-3 tabular-nums">{c.referrers}</td>
                <td className="px-4 py-3 tabular-nums">{c.sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
