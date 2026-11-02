import { notFound } from "next/navigation";
import { ProdutoForm } from "@/components/ProdutoForm";
import { offers } from "@/lib/mock";

export const metadata = { title: "Editar produto" };

export function generateStaticParams() {
  return offers.map((o) => ({ id: o.id }));
}

export default async function EditarProdutoPage({ params }: PageProps<"/empresa/ofertas/[id]/editar">) {
  const { id } = await params;
  const offer = offers.find((o) => o.id === id);
  if (!offer) notFound();
  return <ProdutoForm offer={offer} />;
}
