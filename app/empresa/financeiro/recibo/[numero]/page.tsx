import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { INVOICES, KIND_LABEL } from "@/lib/plataforma";
import { brl } from "@/lib/comissao";

export const metadata = { title: "Recibo" };

export function generateStaticParams() {
  return INVOICES.filter((i) => i.receipt).map((i) => ({ numero: i.receipt! }));
}

export default async function ReciboPage({ params }: PageProps<"/empresa/financeiro/recibo/[numero]">) {
  const { numero } = await params;
  const inv = INVOICES.find((i) => i.receipt === numero);
  if (!inv) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/empresa/financeiro" className="text-sm font-medium text-brand">Voltar</Link>
        <PrintButton />
      </div>
      <article className="rounded-brand border border-line bg-white p-8">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div><h1 className="text-2xl font-semibold">Recibo de pagamento</h1><p className="text-sm text-muted">Nº {inv.receipt}</p></div>
          <p className="text-2xl font-semibold tabular-nums">{brl(inv.amountCents)}</p>
        </header>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Recebido de</dt><dd className="font-medium">{inv.company}</dd></div>
          <div><dt className="text-muted">Recebido por</dt><dd className="font-medium">Indiki+ <span className="text-xs font-normal text-amber-800">(razão social e CNPJ a preencher)</span></dd></div>
          <div><dt className="text-muted">Referente a</dt><dd className="font-medium">{KIND_LABEL[inv.kind]}, {inv.period}</dd></div>
          <div><dt className="text-muted">Fatura</dt><dd className="font-medium">{inv.number}</dd></div>
          <div><dt className="text-muted">Pago em</dt><dd className="font-medium">{inv.paidAt}</dd></div>
          {inv.note && <div><dt className="text-muted">Nota fiscal</dt><dd className="font-medium">{inv.note}</dd></div>}
        </dl>
        {inv.kind === "repasse_comissoes" && <p className="mt-4 text-sm text-muted">Valor recebido para repasse de comissões aos indicadores. Não é receita do Indiki+.</p>}
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Este recibo comprova o pagamento. Não substitui a nota fiscal de serviço.</p>
      </article>
    </div>
  );
}
