import { PageHeader } from "@/components/ui";
import { AdminIndicacoes } from "@/components/admin/Listas";

export const metadata = { title: "Indicações e vendas" };

export default function Pagina() {
  return (
    <>
      <PageHeader title="Indicações e vendas" subtitle="Cada pedido de orçamento, em que etapa está e quanto gerou de comissão." />
      <AdminIndicacoes />
    </>
  );
}
