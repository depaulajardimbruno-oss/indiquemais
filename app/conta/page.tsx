import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <Card className="text-center">
        <h1 className="text-xl font-semibold">Você está dentro</h1>
        <p className="mt-1 text-sm text-muted">O painel para acompanhar suas indicações e comissões chega em breve. Seu cadastro já está salvo.</p>
        <div className="mt-4 flex justify-center"><SignOutButton /></div>
      </Card>
    </main>
  );
}
