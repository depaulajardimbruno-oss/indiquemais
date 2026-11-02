import Link from "next/link";
import { getBrand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { AdminSidebar, AdminTabs } from "@/components/AdminNav";
import { PrototypeBanner } from "@/components/ui";

export const metadata = { title: { default: "Administração", template: "%s · Administração" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const brand = await getBrand();
  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <AdminTabs />
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
          <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
            <Logo name={brand.name} logoUrl={brand.logoUrl} height={28} />
            <span className="rounded-full bg-accent/25 px-2 py-0.5 text-xs font-semibold text-ink">Admin</span>
          </Link>
          <AdminSidebar />
          <div className="mt-auto rounded-brand bg-brand-soft p-3 text-xs text-muted">
            <p className="font-medium text-ink">Administração do Indiki+</p>
            <p>Tudo que você muda aqui vale para a plataforma inteira.</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
