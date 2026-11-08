import { PageHeader } from "@/components/ui";
import { AdminProdutos } from "@/components/admin/Listas";

export const metadata = { title: "Produtos" };

export default function Pagina() {
  return (
    <>
      <PageHeader title="Produtos" subtitle="Produtos de todas as empresas, com regra de comissão e resultado." />
      <AdminProdutos />
    </>
  );
}
