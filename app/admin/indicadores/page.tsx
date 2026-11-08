import { PageHeader } from "@/components/ui";
import { AdminIndicadores } from "@/components/admin/Listas";

export const metadata = { title: "Indicadores" };

export default function Pagina() {
  return (
    <>
      <PageHeader title="Indicadores" subtitle="Todos os indicadores de todas as empresas, com situação do cadastro, comissões e PIX." />
      <AdminIndicadores />
    </>
  );
}
