import { Logo } from "@/components/Logo";
import { MinhaConta } from "@/components/indicador/MinhaConta";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <MinhaConta />
    </main>
  );
}
