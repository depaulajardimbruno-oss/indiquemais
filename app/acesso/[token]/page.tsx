import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { AcessoFlow } from "@/components/AcessoFlow";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Acesso ao painel da empresa" };

async function Conteudo({ params }: { params: PageProps<"/acesso/[token]">["params"] }) {
  const { token } = await params;
  return <AcessoFlow token={decodeURIComponent(token).toUpperCase()} />;
}

export default async function AcessoPage({ params }: PageProps<"/acesso/[token]">) {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <Suspense fallback={<p role="status" className="text-center text-sm text-muted">Abrindo…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}
