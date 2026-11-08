"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Pause, Play, Search, UserPlus, X } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { maskPhone, onlyDigits } from "@/lib/cadastro";
import { useEmpresa } from "@/components/empresa/EmpresaContext";
import { ConviteCard } from "@/components/empresa/ConviteCard";
import { VitrineCard } from "@/components/empresa/VitrineCard";

type Indicador = {
  id: string; full_name: string; email: string | null; phone: string | null; code: string; active: boolean;
  has_account: boolean; registration_complete: boolean; via: "convite" | "manual" | "site"; created_at: string;
  request_status: "pendente" | "aprovado" | "recusado"; requested_at: string | null; city: string | null; state: string | null; profile_kind: string | null;
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

  const pendentes = useMemo(() => (lista ?? []).filter((i) => i.request_status === "pendente"), [lista]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = (lista ?? []).filter((i) => i.request_status !== "pendente");
    if (!q) return base;
    return base.filter((i) => [i.full_name, i.email ?? "", i.phone ?? "", i.code].some((v) => v.toLowerCase().includes(q)));
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

      {pendentes.length > 0 && <Pedidos lista={pendentes} podeDecidir={empresa.can_edit} onDecidiu={carregar} />}

      <ConviteCard companyId={empresa.id} companyName={empresa.name} canEdit={empresa.can_edit} onToken={setToken} />
      <div className="mt-4"><VitrineCard /></div>

      {novo && <NovoIndicador onFechar={() => setNovo(false)} onCriado={async (i) => { setNovo(false); await carregar(); setAcesso(i); }} />}
      {acesso && <CartaoAcesso who={acesso} token={token} origin={origin} empresaNome={empresa.name} onFechar={() => setAcesso(null)} />}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Cadastrados {lista ? `(${lista.length - pendentes.length})` : ""}</h2>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Buscar indicador</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou código" className="w-full rounded-brand border border-line bg-white py-2 pl-9 pr-3 text-sm" />
        </label>
      </div>
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}

      {lista === null && <p role="status" className="mt-4 text-sm text-muted">Carregando…</p>}
      {lista && lista.length - pendentes.length === 0 && (
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
                  <div><dt className="text-xs text-muted">Entrou por</dt><dd>{i.via === "convite" ? "Link de convite" : i.via === "site" ? "Pedido pelo site" : "Cadastro manual"}</dd></div>
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

function Pedidos({ lista, podeDecidir, onDecidiu }: { lista: Indicador[]; podeDecidir: boolean; onDecidiu: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  async function decidir(id: string, aprovar: boolean) {
    setBusy(id); setErro("");
    const { error } = await supabaseBrowser().rpc("company_decide_indicator_request", { p_link: id, p_approve: aprovar, p_note: aprovar ? null : motivo || null });
    setBusy("");
    if (error) return setErro(error.message);
    setRecusando(null); setMotivo("");
    await onDecidiu();
  }
  return (
    <Card className="mb-6 border-2 border-amber-300">
      <h2 className="text-lg font-semibold">{lista.length === 1 ? "1 pessoa quer" : `${lista.length} pessoas querem`} indicar a sua empresa</h2>
      <p className="text-sm text-muted">Pedidos feitos pelo site do Indiki+. Aceite quem você conhece; recusados podem pedir de novo.</p>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      <ul className="mt-3 divide-y divide-line">
        {lista.map((i) => (
          <li key={i.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{i.full_name}</p>
                <p className="text-sm text-muted">{[i.phone, i.email].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-muted">{[[i.city, i.state].filter(Boolean).join("/"), i.profile_kind === "profissional" ? "profissional" : "cliente", i.requested_at ? `pediu em ${new Date(i.requested_at).toLocaleDateString("pt-BR")}` : ""].filter(Boolean).join(" · ")}</p>
              </div>
              {podeDecidir && recusando !== i.id && (
                <div className="flex gap-2">
                  <button onClick={() => decidir(i.id, true)} disabled={busy === i.id} className="min-h-10 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">Aceitar</button>
                  <button onClick={() => setRecusando(i.id)} className={btn}>Recusar</button>
                </div>
              )}
            </div>
            {recusando === i.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block min-w-0 flex-1 text-sm font-medium">Motivo (a pessoa vê; opcional)
                  <input className={field} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: não encontramos você na nossa carteira de clientes" />
                </label>
                <button onClick={() => decidir(i.id, false)} disabled={busy === i.id} className="min-h-12 rounded-brand bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Confirmar recusa</button>
                <button onClick={() => { setRecusando(null); setMotivo(""); }} className={btn}>Cancelar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!podeDecidir && <p className="mt-2 text-xs text-muted">Só o administrador da empresa aceita ou recusa.</p>}
    </Card>
  );
}
