"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type AdminEmpresa = {
  id: string; name: string; legal_name: string | null; cnpj: string | null; status: string; customer_group: string | null;
  plan_code: string | null; plan_name: string | null; members_count: number; pending_invites: number; indicators_count: number; offers_count: number;
};
export type Opcao = { code: string; name: string };
export const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
export const maskCnpj = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

export async function carregarOpcoes() {
  const sb = supabaseBrowser();
  const [{ data: planos }, { data: grupos }] = await Promise.all([
    sb.from("plans").select("code, name").eq("active", true).order("sort_order"),
    sb.from("customer_groups").select("code, name").eq("active", true).order("sort_order"),
  ]);
  return { planos: (planos ?? []) as Opcao[], grupos: (grupos ?? []) as Opcao[] };
}

export function Empresas() {
  const [lista, setLista] = useState<AdminEmpresa[] | null>(null);
  const [nova, setNova] = useState(false);

  useEffect(() => {
    supabaseBrowser().from("admin_companies").select("*").order("name").then(({ data }) => setLista((data ?? []) as AdminEmpresa[]));
  }, []);

  return (
    <>
      <PageHeader title="Empresas" subtitle="Empresas parceiras, plano e quem acessa cada painel."
        action={<button onClick={() => setNova(true)} className="inline-flex min-h-11 items-center gap-2 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90"><Plus size={16} aria-hidden /> Nova empresa</button>} />
      {nova && <NovaEmpresa onFechar={() => setNova(false)} />}
      {lista === null && <p role="status" className="text-sm text-muted">Carregando…</p>}
      {lista?.length === 0 && <Card className="text-center"><p className="font-semibold">Nenhuma empresa cadastrada</p></Card>}
      <ul className="mt-4 space-y-3">
        {lista?.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/empresas/${e.id}`} className="block rounded-brand border border-line bg-white p-5 hover:border-brand">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{e.name}</p>
                  <p className="truncate text-sm text-muted">{e.legal_name} · CNPJ {maskCnpj(e.cnpj ?? "")}</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">{e.plan_name ?? "Sem plano"}</span>
                  {e.status !== "ativa" && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">Suspensa</span>}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-muted">Acessos</dt><dd className={e.members_count === 0 ? "font-medium text-amber-700" : ""}>{e.members_count}{e.pending_invites > 0 ? ` + ${e.pending_invites} convite${e.pending_invites > 1 ? "s" : ""}` : ""}{e.members_count === 0 ? " (sem responsável)" : ""}</dd></div>
                <div><dt className="text-xs text-muted">Produtos ativos</dt><dd>{e.offers_count}</dd></div>
                <div><dt className="text-xs text-muted">Indicadores ativos</dt><dd>{e.indicators_count}</dd></div>
                <div><dt className="text-xs text-muted">Grupo</dt><dd>{e.customer_group ?? "—"}</dd></div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function NovaEmpresa({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const [ops, setOps] = useState<{ planos: Opcao[]; grupos: Opcao[] }>({ planos: [], grupos: [] });
  const [f, setF] = useState({ name: "", legal: "", cnpj: "", group: "", plan: "inicial" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { carregarOpcoes().then(setOps); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    const { data, error } = await supabaseBrowser().rpc("admin_create_company", {
      p_name: f.name, p_legal_name: f.legal, p_cnpj: f.cnpj, p_group: f.group || null, p_plan: f.plan,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    router.push(`/admin/empresas/${data}`);
  }

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Nova empresa</h2>
        <button onClick={onFechar} aria-label="Fechar" className="rounded-brand p-2 hover:bg-brand-soft"><X size={18} aria-hidden /></button>
      </div>
      <form onSubmit={salvar} className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Nome fantasia
          <input required className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Soulglass" />
        </label>
        <label className="block text-sm font-medium">CNPJ
          <input required inputMode="numeric" className={field} value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: maskCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">Razão social
          <input required className={field} value={f.legal} onChange={(e) => setF({ ...f, legal: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">Grupo de cliente
          <select className={field} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            <option value="">Definir depois</option>
            {ops.grupos.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Plano
          <select className={field} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
            {ops.planos.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        {erro && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{erro}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={salvando} className="min-h-11 rounded-brand bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{salvando ? "Cadastrando…" : "Cadastrar e liberar acesso"}</button>
          <p className="mt-2 text-xs text-muted">Depois de cadastrar, você informa o e-mail do responsável na próxima tela.</p>
        </div>
      </form>
    </Card>
  );
}
