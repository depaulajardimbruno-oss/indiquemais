"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { carregarOpcoes, maskCnpj, type Opcao } from "@/components/admin/Empresas";

type Pedido = { id: string; company_name: string; legal_name: string; cnpj: string; contact_name: string; email: string; phone: string; city: string | null; state: string | null;
  segment: string | null; message: string | null; status: string; created_at: string; decided_at: string | null; decision_note: string | null; company_id: string | null; approved_company_name: string | null };
type Resultado = { pedido: Pedido; status: string | null; token: string | null };
const btn = "inline-flex min-h-10 items-center gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";

/** Pedidos de cadastro de empresas: aprovar (cria a empresa e libera o responsável) ou recusar. */
export function PedidosEmpresas({ onAprovou }: { onAprovou: () => void }) {
  const origin = useOrigin();
  const [lista, setLista] = useState<Pedido[] | null>(null);
  const [planos, setPlanos] = useState<Opcao[]>([]);
  const [plano, setPlano] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [verRespondidos, setVerRespondidos] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().from("admin_company_signups").select("*").order("created_at", { ascending: false });
    setLista((data ?? []) as Pedido[]);
  }, []);
  useEffect(() => { void Promise.resolve().then(carregar); carregarOpcoes().then((o) => setPlanos(o.planos)); }, [carregar]);

  async function decidir(p: Pedido, aprovar: boolean) {
    let nota: string | null = null;
    if (!aprovar) { nota = prompt(`Motivo da recusa da ${p.company_name} (fica registrado; opcional):`); if (nota === null) return; }
    setBusy(p.id); setErro(""); setRes(null);
    const { data, error } = await supabaseBrowser().rpc("admin_decide_company_signup", { p_request: p.id, p_approve: aprovar, p_plan: plano[p.id] ?? "inicial", p_note: nota });
    setBusy("");
    if (error) return setErro(error.message);
    const row = Array.isArray(data) ? data[0] : null;
    if (aprovar) { setRes({ pedido: p, status: row?.access_status ?? null, token: row?.access_token ?? null }); onAprovou(); }
    await carregar();
  }

  const pendentes = (lista ?? []).filter((p) => p.status === "pendente");
  const respondidos = (lista ?? []).filter((p) => p.status !== "pendente");
  if (lista === null) return null;

  return (
    <section aria-labelledby="t-pedidos" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="t-pedidos" className="text-lg font-semibold">Pedidos de cadastro {pendentes.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">{pendentes.length}</span>}</h2>
        {respondidos.length > 0 && <button onClick={() => setVerRespondidos((v) => !v)} className="text-sm text-brand underline">{verRespondidos ? "Esconder respondidos" : `Ver respondidos (${respondidos.length})`}</button>}
      </div>
      {res && <ResultadoAprovacao r={res} origin={origin} />}
      {erro && <p role="alert" className="mb-2 text-sm text-red-700">{erro}</p>}
      {pendentes.length === 0 && <Card className="text-sm text-muted">Nenhum pedido aguardando. As empresas pedem pelo endereço <span className="font-mono">{origin}/cadastro-empresa</span>.</Card>}
      <ul className="space-y-3">
        {pendentes.map((p) => (
          <li key={p.id}>
            <Card className="border-2 border-amber-300">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.company_name}</p>
                  <p className="text-sm text-muted">{p.legal_name} · CNPJ {maskCnpj(p.cnpj)}</p>
                  <p className="mt-1 text-sm">{p.contact_name} · {p.email} · {p.phone}</p>
                  <p className="text-xs text-muted">{[[p.city, p.state].filter(Boolean).join("/"), p.segment, `pedido em ${new Date(p.created_at).toLocaleDateString("pt-BR")}`].filter(Boolean).join(" · ")}</p>
                  {p.message && <p className="mt-2 rounded-brand bg-surface p-2 text-sm">{p.message}</p>}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-muted">Plano
                    <select className="mt-1 block rounded-brand border border-line bg-white px-2 py-2 text-sm text-ink" value={plano[p.id] ?? "inicial"} onChange={(e) => setPlano({ ...plano, [p.id]: e.target.value })}>
                      {planos.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </select>
                  </label>
                  <button onClick={() => decidir(p, true)} disabled={busy === p.id} className="min-h-10 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">Aprovar</button>
                  <button onClick={() => decidir(p, false)} disabled={busy === p.id} className={btn}>Recusar</button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {verRespondidos && (
        <ul className="mt-3 divide-y divide-line rounded-brand border border-line bg-white">
          {respondidos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span><strong>{p.company_name}</strong> · {p.email}</span>
              <span className={p.status === "aprovado" ? "text-emerald-700" : "text-rose-700"}>{p.status === "aprovado" ? "Aprovado" : "Recusado"} em {p.decided_at ? new Date(p.decided_at).toLocaleDateString("pt-BR") : "—"}{p.decision_note ? `: ${p.decision_note}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultadoAprovacao({ r, origin }: { r: Resultado; origin: string }) {
  const [copiado, setCopiado] = useState(false);
  if (r.status === "vinculado") return <Card className="mb-3 border-2 border-emerald-300 text-sm"><strong>{r.pedido.company_name}</strong> aprovada. {r.pedido.email} já tinha conta e já acessa o painel da empresa.</Card>;
  const link = `${origin}/acesso/${r.token}`;
  const texto = `Olá, ${r.pedido.contact_name.split(" ")[0]}! O cadastro da ${r.pedido.company_name} no Indiki+ foi aprovado. Crie sua senha e entre no painel da empresa por este link, usando o e-mail ${r.pedido.email}: ${link}`;
  return (
    <Card className="mb-3 border-2 border-emerald-300">
      <p className="font-semibold">{r.pedido.company_name} aprovada. Mande o acesso para {r.pedido.contact_name}</p>
      <p className="mt-1 text-sm text-muted">Pelo link, o responsável cria a senha e entra no painel. Vale 14 dias e só funciona com {r.pedido.email}.</p>
      <p className="mt-3 break-all rounded-brand bg-brand-soft p-3 font-mono text-xs">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={btn} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* link visível */ } }}>
          {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
        </button>
        <a className={btn} href={`https://wa.me/55${r.pedido.phone.replace(/\D/g, "").slice(-11)}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden /> WhatsApp</a>
        <a className={btn} href={`mailto:${r.pedido.email}?subject=${encodeURIComponent(`Cadastro da ${r.pedido.company_name} aprovado no Indiki+`)}&body=${encodeURIComponent(texto)}`}><Mail size={16} aria-hidden /> E-mail</a>
      </div>
    </Card>
  );
}
