import Link from "next/link";
import { getBrand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { AdminGate } from "@/components/AdminGate";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: { default: "Administração", template: "%s · Administração" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const brand = await getBrand();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo name={brand.name} logoUrl={brand.logoUrl} height={28} />
            <span className="rounded-full bg-accent/25 px-2 py-0.5 text-xs font-semibold text-ink">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/empresa" className="text-sm font-medium text-brand underline">Painel das empresas</Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
        <AdminGate>{children}</AdminGate>
      </main>
    </div>
  );
}
