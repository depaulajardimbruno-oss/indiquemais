"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/indicador", label: "Início", icon: Home },
  { href: "/indicador/indicacoes", label: "Indicações", icon: Users },
  { href: "/indicador/comissoes", label: "Comissões", icon: Wallet },
];

const isActive = (path: string, href: string) =>
  href === "/indicador" ? path === href : path.startsWith(href);

/** Barra de baixo no celular (onde o indicador mais vai usar) e abas no topo no computador. */
export function IndicadorNav() {
  const path = usePathname();
  return (
    <>
      <nav className="hidden gap-1 md:flex" aria-label="Navegação do indicador">
        {ITEMS.map(({ href, label }) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`rounded-brand px-3 py-1.5 text-sm font-medium ${
                on ? "bg-brand text-brand-fg" : "text-ink hover:bg-brand-soft"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-line bg-white md:hidden"
        aria-label="Navegação do indicador"
      >
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-xs font-medium ${
                on ? "text-brand" : "text-muted"
              }`}
            >
              <Icon size={20} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
