import { PrototypeBanner } from "@/components/ui";
import { OrcamentoForm } from "@/components/OrcamentoForm";
import { companyById } from "@/lib/indicador";

/** Tela "Peça seu orçamento" de uma empresa, para quem chegou sem link de indicação. */
export function OrcamentoView({ companyId }: { companyId: string }) {
  const company = companyById(companyId);
  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <main className="mx-auto w-full max-w-lg flex-1 p-4 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Peça seu orçamento na {company.name}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Se alguém indicou a {company.name} para você, informe quem no formulário.
        </p>
        <OrcamentoForm company={company.name} products={company.products} />
      </main>
    </div>
  );
}
