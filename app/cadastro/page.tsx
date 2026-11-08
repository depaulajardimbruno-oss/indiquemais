import { Logo } from "@/components/Logo";
import { CadastroFlow } from "@/components/indicador/CadastroFlow";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Quero indicar" };

export default async function CadastroPage() {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <CadastroFlow />
    </main>
  );
}
