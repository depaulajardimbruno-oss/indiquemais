"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Building2, Home, Tag, UserCog, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";

export type Empresa = {
  id: string; name: string; legal_name: string | null; cnpj: string | null; status: string;
  phone: string | null; email: string | null; finance_email: string | null; website: string | null;
  address_zip: string | null; address_street: string | null; address_number: string | null; address_complement: string | null;
  address_district: string | null; address_city: string | null; address_state: string | null;
  customer_group: string | null; my_role: string; can_edit: boolean; plan_code: string | null;
  listing_mode: "fechado" | "aprovacao" | "aberto" | null; public_description: string | null;
};

type Ctx = { empresa: Empresa; empresas: Empresa[]; trocar: (id: string) => void; recarregar: () => Promise<void> };
const EmpresaCtx = createContext<Ctx | null>(null);

export function useEmpresa() {
  const c = useContext(EmpresaCtx);
  if (!c) throw new Error("useEmpresa fora do painel da empresa");
  return c;
}

const CHAVE = "indiki.empresa";
const ler = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
const gravar = (id: string) => { try { localStorage.setItem(CHAVE, id); } catch { /* sem armazenamento: escolhe a primeira */ } };

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/empresa", label: "Início", icon: Home },
  { href: "/empresa/produtos", label: "Produtos", icon: Tag },
  { href: "/empresa/indicadores", label: "Indicadores", icon: Users },
  { href: "/empresa/equipe", label: "Equipe", icon: UserCog },
  { href: "/empresa/dados", label: "Dados da empresa", icon: Building2 },
];
const ativo = (path: string, href: string) => (href === "/empresa" ? path === href : path.startsWith(href));

type Estado = "carregando" | "sem-login" | "sem-empresa" | "ok" | "indisponivel";

/** Confere o acesso, carrega as empresas da pessoa e monta a navegação. */
export function EmpresaShell({ logo, children }: { logo: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(hasSupabase ? "carregando" : "indisponivel");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [id, setId] = useState("");

  const recarregar = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return setEstado("sem-login");
    const { data } = await sb.from("company_my_companies").select("*").order("name");
    const lista = (data ?? []) as Empresa[];
    setEmpresas(lista);
    if (lista.length === 0) return setEstado("sem-empresa");
    setId((atual) => {
      const pref = atual || ler();
      return lista.some((e) => e.id === pref) ? (pref as string) : lista[0].id;
    });
    setEstado("ok");
  }, []);

  useEffect(() => {
    if (!hasSupabase) return;
    void Promise.resolve().then(recarregar);
  }, [recarregar]);

  const empresa = empresas.find((e) => e.id === id);

  if (estado === "indisponivel") return <Centro><h1 className="text-xl font-semibold">Painel indisponível neste ambiente</h1><p className="mt-1 text-sm text-muted">Use o endereço de produção do Indiki+.</p></Centro>;
  if (estado === "carregando" || (estado === "ok" && !empresa)) return <Centro><p role="status" className="text-sm text-muted">Abrindo o painel…</p></Centro>;
  if (estado === "sem-login") return (
    <Centro>
      <h1 className="text-xl font-semibold">Entre para acessar o painel da empresa</h1>
      <Link href="/entrar?destino=/empresa" className="mt-4 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg">Entrar</Link>
    </Centro>
  );
  if (estado === "sem-empresa") return (
    <Centro>
      <h1 className="text-xl font-semibold">Sua conta não está ligada a nenhuma empresa</h1>
      <p className="mt-1 text-sm text-muted">Se você é responsável por uma empresa parceira, fale com o Indiki+ para liberar o acesso.</p>
      <button onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/entrar"); }} className="mt-4 rounded-brand border border-line px-4 py-2 text-sm font-medium">Sair</button>
    </Centro>
  );

  const e = empresa!;
  const trocar = (novo: string) => { setId(novo); gravar(novo); };
  return (
    <EmpresaCtx.Provider value={{ empresa: e, empresas, trocar, recarregar }}>
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1">
          <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
            <Link href="/empresa" className="mb-6 flex items-center gap-2 px-2">
              {logo}
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Empresa</span>
            </Link>
            <nav className="flex flex-col gap-1" aria-label="Navegação da empresa">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} aria-current={ativo(path, href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-brand px-3 py-2 text-sm font-medium ${ativo(path, href) ? "bg-brand text-brand-fg" : "text-ink hover:bg-brand-soft"}`}>
                  <Icon size={18} aria-hidden /> {label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto space-y-2 rounded-brand bg-brand-soft p-3 text-xs">
              <SeletorEmpresa empresas={empresas} id={e.id} trocar={trocar} />
              <p className="text-muted">{e.my_role === "plataforma" ? "Acesso como admin do Indiki+" : e.my_role === "admin" ? "Você é administrador" : "Você é operador"}</p>
              <Sair />
            </div>
          </aside>
          <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
            <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
              <SeletorEmpresa empresas={empresas} id={e.id} trocar={trocar} />
              <Sair />
            </div>
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-white md:hidden" aria-label="Navegação da empresa">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={ativo(path, href) ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-xs font-medium ${ativo(path, href) ? "text-brand" : "text-muted"}`}>
              <Icon size={20} aria-hidden /> {label === "Dados da empresa" ? "Dados" : label}
            </Link>
          ))}
        </nav>
      </div>
    </EmpresaCtx.Provider>
  );
}

function SeletorEmpresa({ empresas, id, trocar }: { empresas: Empresa[]; id: string; trocar: (id: string) => void }) {
  const atual = empresas.find((e) => e.id === id);
  if (empresas.length < 2) return <p className="truncate text-sm font-semibold text-ink">{atual?.name}</p>;
  return (
    <select aria-label="Empresa" value={id} onChange={(ev) => trocar(ev.target.value)} className="w-full max-w-56 rounded-brand border border-line bg-white px-2 py-1.5 text-sm font-semibold">
      {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  );
}

function Sair() {
  const router = useRouter();
  return <button onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/entrar"); }} className="text-sm font-medium text-brand underline">Sair</button>;
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-4"><Card>{children}</Card></main>;
}
