import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { brl } from "@/lib/comissao";

export const metadata = { title: "Informe de rendimentos" };

export function generateStaticParams() {
  return [{ ano: "2026" }];
}

export default async function InformeAnoPage({ params }: PageProps<"/indicador/informe/[ano]">) {
  const { ano } = await params;
  if (ano !== "2026") notFound();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/indicador/informe" className="text-sm font-medium text-brand">Voltar</Link>
        <PrintButton />
      </div>
      <article className="rounded-brand border border-line bg-white p-8">
        <header className="border-b border-line pb-4">
          <h1 className="text-xl font-semibold">Informe de rendimentos pagos a pessoa física</h1>
          <p className="text-sm text-muted">Ano-calendário {ano} · exemplo de apresentação (o modelo oficial será definido com o contador)</p>
        </header>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Fonte pagadora</dt><dd className="font-medium">Indiki+ <span className="text-xs font-normal text-amber-800">(razão social e CNPJ a preencher)</span></dd></div>
          <div><dt className="text-muted">Beneficiário</dt><dd className="font-medium">Marina Souza · CPF 390.533.447-05</dd></div>
        </dl>
        <table className="mt-5 w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-medium">Rendimento</th><th className="py-2 text-right font-medium">Valor</th></tr></thead>
          <tbody className="divide-y divide-line">
            <tr><td className="py-2">Comissões por indicação (rendimento bruto)</td><td className="py-2 text-right tabular-nums">{brl(30000)}</td></tr>
            <tr><td className="py-2">Imposto de renda retido na fonte</td><td className="py-2 text-right tabular-nums">{brl(0)}</td></tr>
            <tr><td className="py-2">Contribuição previdenciária retida</td><td className="py-2 text-right tabular-nums">{brl(0)}</td></tr>
            <tr className="font-semibold"><td className="py-2">Líquido recebido</td><td className="py-2 text-right tabular-nums">{brl(30000)}</td></tr>
          </tbody>
        </table>
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Informe nº IR-2026-000001 · versão 2. Se algum dado mudar, uma nova versão é emitida e a anterior fica guardada.</p>
      </article>
    </div>
  );
}
