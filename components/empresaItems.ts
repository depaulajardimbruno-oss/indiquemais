import { LayoutDashboard, Tag, ShoppingBag, Wallet, Users, ClipboardList, Layers, Receipt, Award, Menu } from "lucide-react";


export const ITEMS = [
  { href: "/empresa", label: "Visão geral", icon: LayoutDashboard },
  { href: "/empresa/ofertas", label: "Produtos", icon: Tag },
  { href: "/empresa/indicadores", label: "Indicadores", icon: Users },
  { href: "/empresa/indicacoes", label: "Indicações", icon: ClipboardList },
  { href: "/empresa/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/empresa/comissoes", label: "Comissões", icon: Wallet },
  { href: "/empresa/plano", label: "Plano", icon: Layers },
  { href: "/empresa/financeiro", label: "Financeiro", icon: Receipt },
  { href: "/empresa/selo", label: "Selo", icon: Award },
];
/** No celular cabem 5 itens: os mais usados ficam na barra e o resto fica em "Mais". */
export const BOTTOM = [
  ITEMS[0], ITEMS[3], ITEMS[2], ITEMS[1],
  { href: "/empresa/mais", label: "Mais", icon: Menu },
];
export const MORE_ITEMS = [ITEMS[4], ITEMS[5], ITEMS[6], ITEMS[7], ITEMS[8]];

