"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  ["/admin", "Visão geral"], ["/admin/empresas", "Empresas"], ["/admin/indicadores", "Indicadores"],
  ["/admin/produtos", "Produtos"], ["/admin/indicacoes", "Indicações e vendas"], ["/admin/comissoes", "Comissões"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Administração" className="border-b border-line bg-white">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {ITENS.map(([href, label]) => {
          const on = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`block border-b-2 px-3 py-3 text-sm font-medium ${on ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
