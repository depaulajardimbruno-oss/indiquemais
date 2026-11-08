"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Equipe } from "@/components/Equipe";
import { AdminComissoes, AdminIndicacoes, AdminIndicadores, AdminProdutos } from "@/components/admin/Listas";
import { carregarOpcoes, field, maskCnpj, type AdminEmpresa, type Opcao } from "@/components/admin/Empresas";

type Aba = "acessos" | "indicadores" | "produtos" | "indicacoes" | "comissoes";
const ABAS: [Aba, string][] = [["acessos", "Acessos, plano e dados"], ["indicadores", "Indicadores"], ["produtos", "Produtos"], ["indicacoes", "Indicações e vendas"], ["comissoes", "Comissões"]];

export function EmpresaDetalhe({ id }: { id: string }) {
  const router = useRouter();
  const [e, setE] = useState<AdminEmpresa | null | undefined>(undefined);
  const [ops, setOps] = useState<{ planos: Opcao[]; grupos: Opcao[] }>({ planos: [], grupos: [] });
  const [aba, setAba] = useState<Aba>("acessos");

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().from("admin_companies").select("*").eq("id", id).maybeSingle();
    setE((data as AdminEmpresa) ?? null);
  }, [id]);
  useEffect(() => { void Promise.resolve().then(carregar); carregarOpcoes().then(setOps); }, [carregar]);

  if (e === undefined) return <p role="status" className="text-sm text-muted">Carregando…</p>;
  if (e === null) return <Card><p className="text-sm">Empresa não encontrada. <Link href="/admin/empresas" className="text-brand underline">Voltar</Link></p></Card>;

  return (
    <>
      <Link href="/admin/empresas" className="mb-3 inline-flex items-center gap-1 text-sm text-brand underline"><ArrowLeft size={14} aria-hidden /> Empresas</Link>
      <PageHeader title={e.name} subtitle={`${e.legal_name ?? ""} · CNPJ ${maskCnpj(e.cnpj ?? "")}`}
        action={<button onClick={() => { try { localStorage.setItem("indiki.empresa", e.id); } catch { /* sem armazenamento */ } router.push("/empresa"); }} className="inline-flex min-h-11 items-center gap-2 rounded-brand border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft"><ExternalLink size={16} aria-hidden /> Abrir painel da empresa</button>} />
      <div role="tablist" aria-label="Seções da empresa" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {ABAS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${aba === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {aba === "indicadores" && <AdminIndicadores companyId={e.id} />}
      {aba === "produtos" && <AdminProdutos companyId={e.id} />}
      {aba === "indicacoes" && <AdminIndicacoes companyId={e.id} />}
      {aba === "comissoes" && <AdminComissoes companyId={e.id} />}
      {aba === "acessos" && <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="t-acessos">
          <h2 id="t-acessos" className="mb-3 text-lg font-semibold">Acessos ao painel</h2>
          <Equipe companyId={e.id} companyName={e.name} canEdit />
        </section>
        <div className="space-y-6">
          <Plano key={`p-${e.plan_code}`} e={e} planos={ops.planos} onSalvo={carregar} />
          <DadosLegais key={`d-${e.cnpj}-${e.status}-${e.customer_group}`} e={e} grupos={ops.grupos} onSalvo={carregar} />
        </div>
      </div>}
    </>
  );
}

function Plano({ e, planos, onSalvo }: { e: AdminEmpresa; planos: Opcao[]; onSalvo: () => Promise<void> }) {
  const [plano, setPlano] = useState(e.plan_code ?? "inicial");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function salvar() {
    setMsg(null);
    const { error } = await supabaseBrowser().rpc("admin_set_company_plan", { p_company: e.id, p_plan: plano, p_note: "Alterado pelo admin" });
    if (error) return setMsg({ ok: false, text: error.message });
    await onSalvo();
    setMsg({ ok: true, text: "Plano alterado." });
  }
  return (
    <Card>
      <h2 className="font-semibold">Plano</h2>
      <label className="mt-2 block text-sm font-medium">Plano atual
        <select className={field} value={plano} onChange={(ev) => setPlano(ev.target.value)}>
          {planos.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </label>
      <button disabled={plano === e.plan_code} onClick={salvar} className="mt-3 min-h-11 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-50">Mudar plano</button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </Card>
  );
}

function DadosLegais({ e, grupos, onSalvo }: { e: AdminEmpresa; grupos: Opcao[]; onSalvo: () => Promise<void> }) {
  const [f, setF] = useState({ legal: e.legal_name ?? "", cnpj: maskCnpj(e.cnpj ?? ""), status: e.status, group: e.customer_group ?? "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setMsg(null);
    const { error } = await supabaseBrowser().rpc("admin_update_company_legal", { p_company: e.id, p_legal_name: f.legal, p_cnpj: f.cnpj, p_status: f.status, p_group: f.group || null });
    if (error) return setMsg({ ok: false, text: error.message });
    await onSalvo();
    setMsg({ ok: true, text: "Dados salvos." });
  }
  return (
    <Card>
      <h2 className="font-semibold">Dados legais e situação</h2>
      <form onSubmit={salvar}>
        <label className="mt-2 block text-sm font-medium">Razão social
          <input required className={field} value={f.legal} onChange={(ev) => setF({ ...f, legal: ev.target.value })} />
        </label>
        <label className="mt-3 block text-sm font-medium">CNPJ
          <input required inputMode="numeric" className={field} value={f.cnpj} onChange={(ev) => setF({ ...f, cnpj: maskCnpj(ev.target.value) })} />
        </label>
        <label className="mt-3 block text-sm font-medium">Grupo de cliente
          <select className={field} value={f.group} onChange={(ev) => setF({ ...f, group: ev.target.value })}>
            <option value="">Não definido</option>
            {grupos.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">Situação
          <select className={field} value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value })}>
            <option value="ativa">Ativa</option>
            <option value="suspensa">Suspensa (links e convites param de funcionar)</option>
          </select>
        </label>
        <button type="submit" className="mt-3 min-h-11 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90">Salvar</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
      </form>
    </Card>
  );
}
