import { notFound } from "next/navigation";
import { PrototypeBanner } from "@/components/ui";
import { OrcamentoForm } from "@/components/OrcamentoForm";
import { companyById, KNOWN_CODES } from "@/lib/indicador";

export const metadata = { title: "Peça seu orçamento" };

// Neste protótipo só os códigos de exemplo existem. No sistema real, o código é buscado no banco.
export function generateStaticParams() {
  return Object.keys(KNOWN_CODES).map((code) => ({ code }));
}

export default async function IndicadoPage({ params }: PageProps<"/i/[code]">) {
  const { code } = await params;
  const referrer = KNOWN_CODES[code.toUpperCase()];
  if (!referrer) notFound();
  const company = companyById(referrer.companyId);

  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <main className="mx-auto w-full max-w-lg flex-1 p-4 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {referrer.firstName} indicou a {company.name} para você
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Peça seu orçamento sem compromisso. Leva menos de um minuto.
        </p>
        <OrcamentoForm company={company.name} products={company.products} referrerFirstName={referrer.firstName} />
      </main>
    </div>
  );
}
