import Link from "next/link";
import { getBrand } from "@/lib/brand";
import { me } from "@/lib/indicador";
import { IndicadorNav } from "@/components/IndicadorNav";
import { PrototypeBanner } from "@/components/ui";

export default async function IndicadorLayout({ children }: LayoutProps<"/indicador">) {
  const brand = await getBrand();
  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/indicador" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-brand bg-brand text-sm font-bold text-brand-fg">
              {brand.name.charAt(0)}
            </span>
            <span className="font-semibold">{brand.name}</span>
          </Link>
          <IndicadorNav />
          <div className="text-right text-xs leading-tight">
            <p className="font-medium">{me.name}</p>
            <p className="text-muted">Cliente {me.company}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
    </div>
  );
}
