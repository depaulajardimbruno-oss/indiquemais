import Link from "next/link";
import { getBrand } from "@/lib/brand";
import { BottomNav, SidebarNav } from "@/components/EmpresaNav";
import { PrototypeBanner } from "@/components/ui";

export default async function EmpresaLayout({ children }: LayoutProps<"/empresa">) {
  const brand = await getBrand();
  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
          <Link href="/empresa" className="mb-6 flex items-center gap-2 px-2">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-brand bg-brand text-sm font-bold text-brand-fg">
                {brand.name.charAt(0)}
              </span>
            )}
            <span className="font-semibold">{brand.name}</span>
          </Link>
          <SidebarNav />
          <div className="mt-auto rounded-brand bg-brand-soft p-3 text-xs text-muted">
            <p className="font-medium text-ink">Loja Exemplo Ltda.</p>
            <p>Painel da empresa</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
