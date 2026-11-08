"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Pause, Play, Search, UserPlus, X } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { maskPhone, onlyDigits } from "@/lib/cadastro";
import { useEmpresa } from "@/components/empresa/EmpresaContext";
import { ConviteCard } from "@/components/empresa/ConviteCard";

type Indicador = {
  id: string; full_name: string; email: string | null; phone: string | null; code: string; active: boolean;
  has_account: boolean; registration_complete: boolean; via: "convite" | "manual"; created_at: string;
  referrals_count: number; sales_count: number;
};

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";

function situacao(i: Indicador) {
  if (!i.active) return { t: "Pausado", c: "bg-slate-100 text-slate-600" };
  if (!i.has_account) return { t: "Aguardando criar a conta", c: "bg-amber-100 text-amber-800" };
  if (!i.registration_complete) return { t: "Cadastro incompleto", c: "bg-amber-100 text-amber-800" };
  return { t: "Ativo", c: "bg-emerald-100 text-emerald-800" };
}

export function Indicadores() {
  const { empresa } = useEmpresa();
  const origin = useOrigin();
  const [lista, setLista] = useState<Indicador[] | null>(null);
  const [busca, setBusca] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [acesso, setAcesso] = useState<Indicador | null>(null);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().from("company_indicators").select("*").eq("company_id", empresa.id).order("created_at", { ascending: false });
    setLista((data ?? []) as Indicador[]);
  }, [empresa.id]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista ?? [];
    return (lista ?? []).filter((i) => [i.full_name, i.email ?? "", i.phone ?? "", i.code].some((v) => v.toLowerCase().includes(q)));
  }, [lista, busca]);

  async function alternar(i: Indicador) {
    setMsg("");
    const { error } = await supabaseBrowser().rpc("company_set_indicator_active", { p_link: i.id, p_active: !i.active });
    if (error) return setMsg(error.message);
    await carregar();
  }

  return (
    <>
      <PageHeader
        title="Indicadores"
        subtitle="Clientes e parceiros que indicam a sua empresa e ganham comissão."
        action={empresa.can_edit ? (
          <button onClick={() => { setNovo(true); setAcesso(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90">
            <UserPlus size={16} aria-hidden /> Cadastrar indicador
          </button>
        ) : undefined}
      />

      <ConviteCard companyId={empresa.id} companyName={empresa.name} canEdit={empresa.can_edit} onToken={setToken} />

      {novo && <NovoIndicador onFechar={() => setNovo(false)} onCriado={async (i) => { setNovo(false); await carregar(); setAcesso(i); }} />}
      {acesso && <CartaoAcesso who={acesso} token={token} origin={origin} empresaNome={empresa.name} onFechar={() => setAcesso(null)} />}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Cadastrados {lista ? `(${lista.length})` : ""}</h2>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Buscar indicador</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou código" className="w-full rounded-brand border border-line bg-white py-2 pl-9 pr-3 text-sm" />
        </label>
      </div>
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}

      {lista === null && <p role="status" className="mt-4 text-sm text-muted">Carregando…</p>}
      {lista?.length === 0 && (
        <Card className="mt-4 text-center">
          <p className="font-semibold">Ninguém cadastrado ainda</p>
          <p className="mt-1 text-sm text-muted">Mande o link de convite acima para seus clientes, ou cadastre um indicador manualmente.</p>
        </Card>
      )}

      <ul className="mt-4 space-y-3">
        {filtrados.map((i) => {
          const s = situacao(i);
          return (
            <li key={i.id}>
              <Card className={i.active ? "" : "opacity-70"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.full_name}</p>
                    <p className="truncate text-sm text-muted">{[i.phone, i.email].filter(Boolean).join(" · ") || "Sem contato"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.c}`}>{s.t}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted">Código</dt><dd className="font-mono text-xs font-semibold">{i.code}</dd></div>
                  <div><dt className="text-xs text-muted">Entrou por</dt><dd>{i.via === "convite" ? "Link de convite" : "Cadastro manual"}</dd></div>
                  <div><dt className="text-xs text-muted">Indicações</dt><dd className="tabular-nums">{i.referrals_count}</dd></div>
                  <div><dt className="text-xs text-muted">Vendas</dt><dd className="tabular-nums">{i.sales_count}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={btn} onClick={() => { setAcesso(i); setNovo(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    <MessageCircle size={16} aria-hidden /> Enviar acesso
                  </button>
                  {empresa.can_edit && (
                    <button className={btn} onClick={() => alternar(i)}>
                      {i.active ? <><Pause size={16} aria-hidden /> Pausar</> : <><Play size={16} aria-hidden /> Reativar</>}
                    </button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {lista && lista.length > 0 && filtrados.length === 0 && <p className="mt-4 text-sm text-muted">Ninguém encontrado com &quot;{busca}&quot;.</p>}
    </>
  );
}

function NovoIndicador({ onFechar, onCriado }: { onFechar: () => void; onCriado: (i: Indicador) => void }) {
  const { empresa } = useEmpresa();
  const [f, setF] = useState({ name: "", email: "", phone: "", since: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.email.trim() && onlyDigits(f.phone).length < 10) return setErro("Informe o e-mail ou o telefone com DDD.");
    setErro(""); setSalvando(true);
    const sb = supabaseBrowser();
    const { data: code, error } = await sb.rpc("company_register_indicator", {
      p_company: empresa.id, p_full_name: f.name, p_email: f.email || null, p_phone: f.phone || null, p_customer_since: f.since || null,
    });
    if (error) { setSalvando(false); return setErro(error.message); }
    const { data } = await sb.from("company_indicators").select("*").eq("company_id", empresa.id).eq("code", code).maybeSingle();
    setSalvando(false);
    if (data) onCriado(data as Indicador);
  }

  return (
    <Card className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Cadastrar indicador</h2>
          <p className="text-sm text-muted">Para quem você quer liberar na hora. O código sai agora; a pessoa cria a conta depois, pelo link de convite, com o mesmo e-mail ou telefone.</p>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="rounded-brand p-2 hover:bg-brand-soft"><X size={18} aria-hidden /></button>
      </div>
      <form onSubmit={salvar} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">Nome completo
          <input required className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">Telefone (WhatsApp)
          <input type="tel" className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
        </label>
        <label className="block text-sm font-medium">E-mail
          <input type="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="block text-sm font-medium">Cliente desde (opcional)
          <input type="date" className={field} value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={salvando} className="min-h-11 w-full rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{salvando ? "Salvando…" : "Cadastrar e gerar código"}</button>
        </div>
        {erro && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{erro}</p>}
      </form>
    </Card>
  );
}

function CartaoAcesso({ who, token, origin, empresaNome, onFechar }: { who: Indicador; token: string | null; origin: string; empresaNome: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState<"link" | "code" | null>(null);
  const link = `${origin}/i/${who.code}`;
  const first = who.full_name.split(" ")[0];
  const conta = !who.has_account && token ? `\n\nPara acompanhar suas indicações e receber as comissões por PIX, crie sua conta aqui${who.email ? ` com o e-mail ${who.email}` : ""}: ${origin}/convite/${token}` : "";
  const msg = `Olá, ${first}! Você agora pode indicar amigos para a ${empresaNome} e ganhar comissão pelo Indiki+.\n\nSeu código: ${who.code}\nSeu link para mandar aos amigos: ${link}${conta}`;
  const digits = who.phone ? onlyDigits(who.phone).slice(-11) : "";
  const wa = `https://wa.me/${digits ? `55${digits}` : ""}?text=${encodeURIComponent(msg)}`;
  async function copiar(o: "link" | "code") {
    try { await navigator.clipboard.writeText(o === "link" ? link : who.code); setCopiado(o); setTimeout(() => setCopiado(null), 2000); } catch { /* fica visível para copiar */ }
  }
  return (
    <Card className="mt-6 border-2 border-accent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Acesso de {who.full_name}</h2>
          <p className="text-sm text-muted">Mande o código e o link para a pessoa. Eles valem só para a {empresaNome}.</p>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="rounded-brand p-2 hover:bg-brand-soft"><X size={18} aria-hidden /></button>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <dt className="text-xs text-muted">Código</dt>
          <dd className="mt-1 flex items-center gap-2"><span className="font-mono text-lg font-semibold">{who.code}</span>
            <button onClick={() => copiar("code")} aria-label="Copiar código" className="rounded-brand p-1.5 hover:bg-brand-soft">{copiado === "code" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}</button></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">Link para os amigos pedirem orçamento</dt>
          <dd className="mt-1 flex items-center gap-2"><span className="truncate font-mono text-xs">{link}</span>
            <button onClick={() => copiar("link")} aria-label="Copiar link" className="shrink-0 rounded-brand p-1.5 hover:bg-brand-soft">{copiado === "link" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}</button></dd>
        </div>
      </dl>
      {!who.has_account && !token && <p className="mt-3 text-sm text-amber-800">O link de convite está pausado: a pessoa recebe o código, mas só consegue criar a conta quando você reativar o convite.</p>}
      <a href={wa} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90">
        <MessageCircle size={16} aria-hidden /> Enviar por WhatsApp{digits ? ` para ${who.phone}` : ""}
      </a>
    </Card>
  );
}
