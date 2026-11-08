import { Suspense } from "react";
import { getBrand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { EmpresaShell } from "@/components/empresa/EmpresaContext";

export const metadata = { title: { default: "Painel da empresa", template: "%s · Empresa" } };

export default async function EmpresaLayout({ children }: LayoutProps<"/empresa">) {
  const brand = await getBrand();
  return (
    <Suspense fallback={<p role="status" className="p-8 text-center text-sm text-muted">Abrindo o painel…</p>}>
      <EmpresaShell logo={<Logo name={brand.name} logoUrl={brand.logoUrl} height={28} />}>{children}</EmpresaShell>
    </Suspense>
  );
}
