"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Tag, ShoppingBag, Wallet, Users } from "lucide-react";

const ITEMS = [
  { href: "/empresa", label: "Visão geral", icon: LayoutDashboard },
  { href: "/empresa/ofertas", label: "Produtos", icon: Tag },
  { href: "/empresa/indicadores", label: "Indicadores", icon: Users },
  { href: "/empresa/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/empresa/comissoes", label: "Comissões", icon: Wallet },
];

function isActive(path: string, href: string) {
  return href === "/empresa" ? path === href : path.startsWith(href);
}

export function SidebarNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação da empresa">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const on = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-brand px-3 py-2 text-sm font-medium transition-colors ${
              on ? "bg-brand text-brand-fg" : "text-ink hover:bg-brand-soft"
            }`}
          >
            <Icon size={18} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-white md:hidden"
      aria-label="Navegação da empresa"
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
  );
}
