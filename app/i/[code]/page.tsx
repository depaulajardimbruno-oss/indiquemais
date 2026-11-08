import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { PedidoOrcamento } from "@/components/PedidoOrcamento";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Peça seu orçamento" };

async function Conteudo({ params }: { params: PageProps<"/i/[code]">["params"] }) {
  const { code } = await params;
  return <PedidoOrcamento code={decodeURIComponent(code).toUpperCase()} />;
}

export default async function IndicacaoPage({ params }: PageProps<"/i/[code]">) {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <Suspense fallback={<p role="status" className="text-center text-sm text-muted">Abrindo…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}
