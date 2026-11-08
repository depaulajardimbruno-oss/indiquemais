"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { brl, describeRule } from "@/lib/comissao";
import { COMISSAO, ETAPA, ETAPAS_ORDEM, Selo, dataBR } from "@/lib/rotulos";

type Empresa = { id: string; name: string };

/** Busca uma visão do admin, opcionalmente filtrada por empresa. */
function useVisao<T>(visao: string, companyId?: string, ordem = "created_at") {
  const [dados, setDados] = useState<T[] | null>(null);
  useEffect(() => {
    let vivo = true;
    let q = supabaseBrowser().from(visao).select("*").order(ordem, { ascending: false }).limit(1000);
    if (companyId) q = q.eq("company_id", companyId);
    q.then(({ data }) => { if (vivo) setDados((data ?? []) as T[]); });
    return () => { vivo = false; };
  }, [visao, companyId, ordem]);
  return dados;
}

function useEmpresas(ativo: boolean) {
  const [lista, setLista] = useState<Empresa[]>([]);
  useEffect(() => {
    if (!ativo) return;
    supabaseBrowser().from("admin_companies").select("id, name").order("name").then(({ data }) => setLista((data ?? []) as Empresa[]));
  }, [ativo]);
  return lista;
}

const sel = "rounded-brand border border-line bg-white px-3 py-2 text-sm";

function Filtros({ empresas, empresa, setEmpresa, busca, setBusca, placeholder, children }: {
  empresas: Empresa[]; empresa: string; setEmpresa: (v: string) => void; busca: string; setBusca: (v: string) => void; placeholder: string; children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {empresas.length > 0 && (
        <select aria-label="Empresa" className={sel} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      )}
      {children}
      <label className="relative min-w-0 flex-1 sm:max-w-72">
        <span className="sr-only">Buscar</span>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder} className="w-full rounded-brand border border-line bg-white py-2 pl-9 pr-3 text-sm" />
      </label>
    </div>
  );
}

function Tabela({ cab, vazio, children, n }: { cab: string[]; vazio: string; children: React.ReactNode; n: number | null }) {
  if (n === null) return <p role="status" className="text-sm text-muted">Carregando…</p>;
  if (n === 0) return <Card className="text-center text-sm text-muted">{vazio}</Card>;
  return (
    <div className="min-w-0 overflow-x-auto rounded-brand border border-line bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line bg-surface text-xs text-muted">
          <tr>{cab.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

const bate = (q: string, ...vals: (string | null | undefined)[]) => !q || vals.some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
const Total = ({ itens }: { itens: [string, string][] }) => (
  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {itens.map(([l, v]) => <Card key={l} className="!p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 text-lg font-semibold tabular-nums">{v}</p></Card>)}
  </div>
);

// ------------------------------------------------------------------ Indicadores
type Ind = { id: string; company_id: string; company_name: string; full_name: string; email: string | null; phone: string | null; code: string; active: boolean;
  has_account: boolean; registration_complete: boolean; via: string; city: string | null; state: string | null; pix_key_type: string | null; pix_key: string | null;
  cpf_masked: string | null; referrals_count: number; sales_count: number; pending_cents: number; released_cents: number; paid_cents: number };
function situacao(i: Ind) {
  if (!i.active) return ["Pausado", "bg-slate-100 text-slate-600"];
  if (!i.has_account) return ["Sem conta", "bg-amber-100 text-amber-800"];
  if (!i.registration_complete) return ["Cadastro incompleto", "bg-amber-100 text-amber-800"];
  return ["Ativo", "bg-emerald-100 text-emerald-800"];
}

export function AdminIndicadores({ companyId }: { companyId?: string }) {
  const empresas = useEmpresas(!companyId);
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const [sit, setSit] = useState("");
  const dados = useVisao<Ind>("admin_indicators", companyId || empresa || undefined);
  const lista = useMemo(() => (dados ?? []).filter((i) => bate(busca, i.full_name, i.email, i.phone, i.code, i.company_name) && (!sit || situacao(i)[0] === sit)), [dados, busca, sit]);
  return (
    <>
      <Filtros empresas={empresas} empresa={empresa} setEmpresa={setEmpresa} busca={busca} setBusca={setBusca} placeholder="Nome, telefone, e-mail ou código">
        <select aria-label="Situação" className={sel} value={sit} onChange={(e) => setSit(e.target.value)}>
          <option value="">Todas as situações</option>
          {["Ativo", "Cadastro incompleto", "Sem conta", "Pausado"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </Filtros>
      <Total itens={[["Indicadores", String(lista.length)], ["Com cadastro completo", String(lista.filter((i) => i.registration_complete).length)],
        ["Comissão a liberar", brl(lista.reduce((t, i) => t + i.pending_cents, 0))], ["Comissão paga", brl(lista.reduce((t, i) => t + i.paid_cents, 0))]]} />
      <Tabela n={dados ? lista.length : null} vazio="Nenhum indicador com esses filtros." cab={["Indicador", ...(companyId ? [] : ["Empresa"]), "Situação", "Código", "Indicações / vendas", "Comissão (a liberar · liberada · paga)", "PIX e CPF"]}>
        {lista.map((i) => {
          const [t, c] = situacao(i);
          return (
            <tr key={i.id} className="align-top">
              <td className="px-3 py-3"><p className="font-medium">{i.full_name}</p><p className="text-xs text-muted">{[i.phone, i.email].filter(Boolean).join(" · ")}</p><p className="text-xs text-muted">{[[i.city, i.state].filter(Boolean).join("/"), i.via === "convite" ? "entrou por convite" : "cadastro manual"].filter(Boolean).join(" · ")}</p></td>
              {!companyId && <td className="px-3 py-3"><Link href={`/admin/empresas/${i.company_id}`} className="text-brand underline">{i.company_name}</Link></td>}
              <td className="px-3 py-3"><Selo texto={t} cls={c} /></td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{i.code}</td>
              <td className="px-3 py-3 tabular-nums">{i.referrals_count} / {i.sales_count}</td>
              <td className="px-3 py-3 tabular-nums">{brl(i.pending_cents)} · {brl(i.released_cents)} · {brl(i.paid_cents)}</td>
              <td className="px-3 py-3 text-xs">{i.pix_key ? <><span className="text-muted">{i.pix_key_type}:</span> {i.pix_key}</> : <span className="text-amber-700">Sem PIX</span>}<br /><span className="text-muted">CPF {i.cpf_masked ?? "não informado"}</span></td>
            </tr>
          );
        })}
      </Tabela>
    </>
  );
}

// ------------------------------------------------------------------ Produtos
type Prod = { id: string; company_id: string; company_name: string; name: string; description: string | null; commission_fixed_cents: number | null; commission_percent_bps: number | null;
  commission_cap_cents: number | null; grace_days: number; active: boolean; rule_version: number; referrals_count: number; sales_count: number; sales_cents: number; commissions_cents: number };

export function AdminProdutos({ companyId }: { companyId?: string }) {
  const empresas = useEmpresas(!companyId);
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const dados = useVisao<Prod>("admin_offers", companyId || empresa || undefined);
  const lista = useMemo(() => (dados ?? []).filter((p) => bate(busca, p.name, p.company_name)), [dados, busca]);
  return (
    <>
      <Filtros empresas={empresas} empresa={empresa} setEmpresa={setEmpresa} busca={busca} setBusca={setBusca} placeholder="Nome do produto" />
      <Total itens={[["Produtos", String(lista.length)], ["Ativos", String(lista.filter((p) => p.active).length)],
        ["Vendido por indicação", brl(lista.reduce((t, p) => t + p.sales_cents, 0))], ["Comissões geradas", brl(lista.reduce((t, p) => t + p.commissions_cents, 0))]]} />
      <Tabela n={dados ? lista.length : null} vazio="Nenhum produto com esses filtros." cab={["Produto", ...(companyId ? [] : ["Empresa"]), "Situação", "Regra de comissão", "Indicações / vendas", "Vendido", "Comissões"]}>
        {lista.map((p) => (
          <tr key={p.id} className="align-top">
            <td className="px-3 py-3"><p className="font-medium">{p.name}</p>{p.description && <p className="max-w-xs text-xs text-muted">{p.description}</p>}</td>
            {!companyId && <td className="px-3 py-3"><Link href={`/admin/empresas/${p.company_id}`} className="text-brand underline">{p.company_name}</Link></td>}
            <td className="px-3 py-3"><Selo texto={p.active ? "Ativo" : "Pausado"} cls={p.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"} /></td>
            <td className="px-3 py-3">{describeRule({ fixedCents: p.commission_fixed_cents, percentBps: p.commission_percent_bps, capCents: p.commission_cap_cents })}<p className="text-xs text-muted">carência {p.grace_days} dias · versão {p.rule_version}</p></td>
            <td className="px-3 py-3 tabular-nums">{p.referrals_count} / {p.sales_count}</td>
            <td className="px-3 py-3 tabular-nums">{brl(p.sales_cents)}</td>
            <td className="px-3 py-3 tabular-nums">{brl(p.commissions_cents)}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

// ------------------------------------------------------------------ Indicações e vendas
type Ref = { id: string; company_id: string; company_name: string; offer_name: string; referrer_name: string | null; referrer_code: string | null; friend_name: string; friend_phone: string;
  source: string; stage: string; created_at: string; sale_value_cents: number | null; contract_number: string | null; declared_referrer_name: string | null;
  awaiting_confirmation: boolean; commission_cents: number | null; commission_status: string | null };

export function AdminIndicacoes({ companyId }: { companyId?: string }) {
  const empresas = useEmpresas(!companyId);
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  useEffect(() => {
    const e = new URLSearchParams(location.search).get("etapa");
    if (e && e in ETAPA) void Promise.resolve().then(() => setEtapa(e));
  }, []);
  const dados = useVisao<Ref>("admin_referrals", companyId || empresa || undefined);
  const lista = useMemo(() => (dados ?? []).filter((r) => bate(busca, r.friend_name, r.friend_phone, r.referrer_name, r.referrer_code, r.offer_name, r.contract_number) && (!etapa || r.stage === etapa)), [dados, busca, etapa]);
  const vendas = lista.filter((r) => ["fechou", "instalada", "paga"].includes(r.stage));
  return (
    <>
      <Filtros empresas={empresas} empresa={empresa} setEmpresa={setEmpresa} busca={busca} setBusca={setBusca} placeholder="Amigo, indicador, produto ou contrato">
        <select aria-label="Etapa" className={sel} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
          <option value="">Todas as etapas</option>
          {ETAPAS_ORDEM.map((s) => <option key={s} value={s}>{ETAPA[s].label}</option>)}
        </select>
      </Filtros>
      <Total itens={[["Indicações", String(lista.length)], ["Vendas", String(vendas.length)],
        ["Valor vendido", brl(vendas.reduce((t, r) => t + (r.sale_value_cents ?? 0), 0))], ["Comissões", brl(lista.reduce((t, r) => t + (r.commission_cents ?? 0), 0))]]} />
      <Tabela n={dados ? lista.length : null} vazio="Nenhuma indicação com esses filtros." cab={["Data", ...(companyId ? [] : ["Empresa"]), "Amigo indicado", "Produto", "Quem indicou", "Etapa", "Venda", "Comissão"]}>
        {lista.map((r) => (
          <tr key={r.id} className="align-top">
            <td className="px-3 py-3 tabular-nums">{dataBR(r.created_at)}</td>
            {!companyId && <td className="px-3 py-3"><Link href={`/admin/empresas/${r.company_id}`} className="text-brand underline">{r.company_name}</Link></td>}
            <td className="px-3 py-3"><p className="font-medium">{r.friend_name}</p><p className="text-xs text-muted">{r.friend_phone}</p></td>
            <td className="px-3 py-3">{r.offer_name}</td>
            <td className="px-3 py-3">{r.referrer_name ? <>{r.referrer_name}<p className="font-mono text-xs text-muted">{r.referrer_code}</p></> : r.declared_referrer_name ? <span className="text-amber-700">Informou: {r.declared_referrer_name}</span> : <span className="text-muted">Sem indicador</span>}{r.awaiting_confirmation && <p className="text-xs text-amber-700">aguardando confirmação</p>}</td>
            <td className="px-3 py-3"><Selo texto={ETAPA[r.stage]?.label ?? r.stage} cls={ETAPA[r.stage]?.cls ?? ""} /></td>
            <td className="px-3 py-3 tabular-nums">{r.sale_value_cents != null ? brl(r.sale_value_cents) : "—"}{r.contract_number && <p className="text-xs text-muted">contrato {r.contract_number}</p>}</td>
            <td className="px-3 py-3 tabular-nums">{r.commission_cents != null ? <>{brl(r.commission_cents)}<br /><Selo texto={COMISSAO[r.commission_status!]?.label ?? r.commission_status!} cls={COMISSAO[r.commission_status!]?.cls ?? ""} /></> : "—"}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

// ------------------------------------------------------------------ Comissões
type Com = { id: string; company_id: string; company_name: string; referrer_name: string; referrer_code: string; offer_name: string; friend_name: string; sale_value_cents: number | null;
  contract_number: string | null; amount_cents: number; status: string; release_date: string | null; paid_at: string | null; created_at: string; pix_key_type: string | null; pix_key: string | null };

export function AdminComissoes({ companyId }: { companyId?: string }) {
  const empresas = useEmpresas(!companyId);
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const [st, setSt] = useState("");
  const dados = useVisao<Com>("admin_commissions", companyId || empresa || undefined);
  const lista = useMemo(() => (dados ?? []).filter((c) => bate(busca, c.referrer_name, c.referrer_code, c.friend_name, c.offer_name, c.contract_number) && (!st || c.status === st)), [dados, busca, st]);
  const soma = (s: string[]) => brl(lista.filter((c) => s.includes(c.status)).reduce((t, c) => t + c.amount_cents, 0));
  return (
    <>
      <Filtros empresas={empresas} empresa={empresa} setEmpresa={setEmpresa} busca={busca} setBusca={setBusca} placeholder="Indicador, amigo, produto ou contrato">
        <select aria-label="Situação" className={sel} value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">Todas as situações</option>
          {Object.entries(COMISSAO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Filtros>
      <Total itens={[["Pendente (carência)", soma(["pendente"])], ["Liberada para pagar", soma(["liberada"])], ["Paga", soma(["paga", "confirmada"])], ["Contestada", soma(["contestada"])]]} />
      <Tabela n={dados ? lista.length : null} vazio="Nenhuma comissão com esses filtros." cab={["Gerada em", ...(companyId ? [] : ["Empresa"]), "Indicador", "Venda", "Valor", "Situação", "Liberação / pagamento", "PIX"]}>
        {lista.map((c) => (
          <tr key={c.id} className="align-top">
            <td className="px-3 py-3 tabular-nums">{dataBR(c.created_at)}</td>
            {!companyId && <td className="px-3 py-3"><Link href={`/admin/empresas/${c.company_id}`} className="text-brand underline">{c.company_name}</Link></td>}
            <td className="px-3 py-3">{c.referrer_name}<p className="font-mono text-xs text-muted">{c.referrer_code}</p></td>
            <td className="px-3 py-3">{c.offer_name} para {c.friend_name}<p className="text-xs text-muted">{c.sale_value_cents != null ? brl(c.sale_value_cents) : ""}{c.contract_number ? ` · contrato ${c.contract_number}` : ""}</p></td>
            <td className="px-3 py-3 font-semibold tabular-nums">{brl(c.amount_cents)}</td>
            <td className="px-3 py-3"><Selo texto={COMISSAO[c.status]?.label ?? c.status} cls={COMISSAO[c.status]?.cls ?? ""} /></td>
            <td className="px-3 py-3 tabular-nums">{c.paid_at ? `paga em ${dataBR(c.paid_at)}` : `libera em ${dataBR(c.release_date)}`}</td>
            <td className="px-3 py-3 text-xs">{c.pix_key ? <><span className="text-muted">{c.pix_key_type}:</span> {c.pix_key}</> : <span className="text-amber-700">Sem PIX</span>}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
