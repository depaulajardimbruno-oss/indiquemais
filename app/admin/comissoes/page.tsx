import { PageHeader } from "@/components/ui";
import { AdminComissoes } from "@/components/admin/Listas";

export const metadata = { title: "Comissões" };

export default function Pagina() {
  return (
    <>
      <PageHeader title="Comissões" subtitle="O que está em carência, o que já pode ser pago e o que foi pago." />
      <AdminComissoes />
    </>
  );
}
