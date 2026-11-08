import { Logo } from "@/components/Logo";
import { CadastroEmpresa } from "@/components/CadastroEmpresa";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Cadastrar minha empresa" };

export default async function CadastroEmpresaPage() {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <CadastroEmpresa />
    </main>
  );
}
