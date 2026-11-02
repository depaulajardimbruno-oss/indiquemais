import Link from "next/link";
import { Building2, FileText, LogIn, UserRound } from "lucide-react";
import { getBrand } from "@/lib/brand";
import { PrototypeBanner } from "@/components/ui";
import { companies } from "@/lib/indicador";

const SCREENS = [
  {
    href: "/empresa",
    icon: Building2,
    title: "Painel da empresa",
    text: "Como a empresa piloto (Soulglass) acompanha ofertas, vendas e comissões.",
  },
  {
    href: "/entrar",
    icon: LogIn,
    title: "Entrar como indicador",
    text: "Tela de acesso por link no e-mail, sem senha.",
  },
  {
    href: "/cadastro",
    icon: UserRound,
    title: "Cliente pede acesso pelo site",
    text: "O cliente se cadastra e a empresa libera o link dele.",
  },
  {
    href: "/empresa/indicadores",
    icon: Building2,
    title: "Empresa libera indicadores",
    text: "A empresa cadastra o cliente, gera código e link, e responde pedidos do site.",
  },
  {
    href: "/indicador",
    icon: UserRound,
    title: "Painel do indicador",
    text: "O cliente que indica: link, indicações, etapas e comissões.",
  },
  {
    href: `/i/${companies[0].code}`,
    icon: FileText,
    title: "Página do amigo indicado (pelo link)",
    text: "O que quem recebe o link vê ao pedir orçamento.",
  },
  {
    href: "/orcamento",
    icon: FileText,
    title: "Pedido de orçamento (sem link)",
    text: "O amigo informa quem indicou, pelo nome e telefone.",
  },
];

export const metadata = { title: "Telas do protótipo" };

export default async function Prototipo() {
  const brand = await getBrand();
  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:py-12">
        <Link href="/" className="text-sm font-medium text-brand">
          Voltar ao site
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{brand.name}: telas do protótipo</h1>
        <p className="mt-1 text-muted">{brand.tagline}</p>
        <p className="mt-6 mb-3 text-sm font-medium">
          Protótipo com a empresa piloto Soulglass. Escolha uma tela:
        </p>
        <ul className="space-y-3">
          {SCREENS.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-brand border border-line bg-white p-4 hover:border-brand"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-brand bg-brand-soft text-brand">
                  <Icon size={18} aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
