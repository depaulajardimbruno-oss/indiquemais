import { Suspense } from "react";
import { EmpresaDetalhe } from "@/components/admin/EmpresaDetalhe";

export const metadata = { title: "Empresa" };

async function Conteudo({ params }: { params: PageProps<"/admin/empresas/[id]">["params"] }) {
  const { id } = await params;
  return <EmpresaDetalhe id={id} />;
}

export default function EmpresaPage({ params }: PageProps<"/admin/empresas/[id]">) {
  return <Suspense fallback={<p role="status" className="text-sm text-muted">Carregando…</p>}><Conteudo params={params} /></Suspense>;
}
