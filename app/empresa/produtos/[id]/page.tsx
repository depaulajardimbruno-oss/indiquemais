import { Suspense } from "react";
import { ProdutoForm } from "@/components/empresa/ProdutoForm";

export const metadata = { title: "Editar produto" };

async function Conteudo({ params }: { params: PageProps<"/empresa/produtos/[id]">["params"] }) {
  const { id } = await params;
  return <ProdutoForm id={id} />;
}

export default function EditarProdutoPage({ params }: PageProps<"/empresa/produtos/[id]">) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted">Carregando…</p>}>
      <Conteudo params={params} />
    </Suspense>
  );
}
