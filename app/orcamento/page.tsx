import { PrototypeBanner } from "@/components/ui";
import { OrcamentoForm } from "@/components/OrcamentoForm";
import { me } from "@/lib/indicador";

export const metadata = { title: "Peça seu orçamento" };

export default function OrcamentoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <main className="mx-auto w-full max-w-lg flex-1 p-4 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Peça seu orçamento na {me.company}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Se alguém indicou a {me.company} para você, informe quem no formulário.
        </p>
        <OrcamentoForm company={me.company} />
      </main>
    </div>
  );
}
