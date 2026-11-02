"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Layers, Users2, Award, Trophy, Receipt, Landmark } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/planos", label: "Planos", icon: Layers },
  { href: "/admin/grupos", label: "Grupos de cliente", icon: Users2 },
  { href: "/admin/selos", label: "Selos e certificados", icon: Award },
  { href: "/admin/ranking", label: "Ranking de indicadores", icon: Trophy },
  { href: "/admin/cobranca", label: "Cobrança e repasses", icon: Receipt },
  { href: "/admin/fiscal", label: "Fiscal", icon: Landmark },
];
const isActive = (path: string, href: string) => (href === "/admin" ? path === href : path.startsWith(href));

export function AdminSidebar() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação do administrador">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-brand px-3 py-2 text-sm font-medium transition-colors ${on ? "bg-brand text-brand-fg" : "text-ink hover:bg-brand-soft"}`}>
            <Icon size={18} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** No celular, abas com rolagem lateral no topo. */
export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line bg-white px-2 py-2 md:hidden" aria-label="Navegação do administrador">
      {ITEMS.map(({ href, label }) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${on ? "bg-brand text-brand-fg" : "text-ink"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
