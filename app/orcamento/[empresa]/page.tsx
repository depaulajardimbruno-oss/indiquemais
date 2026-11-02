import { notFound } from "next/navigation";
import { OrcamentoView } from "@/components/OrcamentoView";
import { companies } from "@/lib/indicador";

export const metadata = { title: "Peça seu orçamento" };

export function generateStaticParams() {
  return companies.map((c) => ({ empresa: c.id }));
}

export default async function OrcamentoEmpresaPage({ params }: PageProps<"/orcamento/[empresa]">) {
  const { empresa } = await params;
  if (!companies.some((c) => c.id === empresa)) notFound();
  return <OrcamentoView companyId={empresa} />;
}
