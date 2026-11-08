"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { StageProgress } from "@/components/StageProgress";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { brl } from "@/lib/comissao";
import { PIX_TYPES, type PixType } from "@/lib/cadastro";
import { dataBR } from "@/lib/rotulos";
import type { Stage } from "@/lib/etapas";

type Indicacao = { id: string; company_name: string; offer_name: string; friend: string; stage: Stage; created_at: string; awaiting_my_confirmation: boolean;
  commission_cents: number | null; commission_status: string | null; release_date: string | null; paid_at: string | null };
type Pendente = { id: string; company_name: string; friend: string; created_at: string };

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";

/** Resumo de comissões, chave PIX, confirmações pendentes e lista de indicações. */
export function PainelIndicador({ temVinculo }: { temVinculo: boolean }) {
  const [lista, setLista] = useState<Indicacao[] | null>(null);
  const [pend, setPend] = useState<Pendente[]>([]);
  const [pix, setPix] = useState<{ type: string | null; key: string | null } | null>(null);

  const carregar = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: r }, { data: p }, { data: me }] = await Promise.all([
      sb.from("indicator_my_referrals").select("*").order("created_at", { ascending: false }),
      sb.from("indicator_pending_declarations").select("*"),
      sb.from("indicator_my_profile").select("pix_key_type, pix_key").maybeSingle(),
    ]);
    setLista((r ?? []) as Indicacao[]);
    setPend((p ?? []) as Pendente[]);
    setPix({ type: me?.pix_key_type ?? null, key: me?.pix_key ?? null });
  }, []);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  if (lista === null) return null;
  const soma = (s: string[]) => lista.filter((i) => i.commission_status && s.includes(i.commission_status)).reduce((t, i) => t + (i.commission_cents ?? 0), 0);
  const aReceber = soma(["pendente", "liberada"]);
  const recebido = soma(["paga", "confirmada"]);
  const abertas = lista.filter((i) => !["paga", "perdido"].includes(i.stage)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="min-w-0 !p-3 sm:!p-4"><p className="text-xs text-muted">A receber</p><p className="mt-1 text-base font-semibold tabular-nums sm:text-xl text-amber-700">{brl(aReceber)}</p></Card>
        <Card className="min-w-0 !p-3 sm:!p-4"><p className="text-xs text-muted">Já recebido</p><p className="mt-1 text-base font-semibold tabular-nums sm:text-xl text-emerald-700">{brl(recebido)}</p></Card>
        <Card className="min-w-0 !p-3 sm:!p-4"><p className="text-xs text-muted">Em andamento</p><p className="mt-1 text-base font-semibold tabular-nums sm:text-xl">{abertas}</p></Card>
      </div>

      {pix && <CartaoPix atual={pix} destaque={!pix.key && (aReceber > 0 || temVinculo)} onSalvo={carregar} />}

      {pend.length > 0 && <Confirmacoes lista={pend} onRespondeu={carregar} />}

      <Card>
        <h2 className="font-semibold">Minhas indicações</h2>
        {lista.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma ainda. Mande o seu link para amigos que precisam do serviço: quando eles pedirem orçamento, a indicação aparece aqui.</p>}
        <ul className="mt-2 divide-y divide-line">
          {lista.map((i) => (
            <li key={i.id} className="py-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{i.friend} <span className="font-normal text-muted">· {i.offer_name} na {i.company_name}</span></p>
                <span className="text-xs text-muted">{dataBR(i.created_at)}</span>
              </div>
              <StageProgress stage={i.stage} />
              {i.commission_cents != null && i.stage !== "perdido" && (
                <p className="mt-2 rounded-brand bg-brand-soft px-3 py-2 text-sm">
                  Sua comissão: <strong>{brl(i.commission_cents)}</strong>
                  {i.commission_status === "pendente" && (i.release_date ? ` · liberada em ${dataBR(i.release_date)}, paga no fim daquele mês` : " · liberada depois que o serviço for instalado e pago")}
                  {i.commission_status === "liberada" && " · liberada, entra no pagamento do fim do mês"}
                  {(i.commission_status === "paga" || i.commission_status === "confirmada") && ` · paga em ${dataBR(i.paid_at)}`}
                  {i.commission_status === "contestada" && " · em análise"}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CartaoPix({ atual, destaque, onSalvo }: { atual: { type: string | null; key: string | null }; destaque: boolean; onSalvo: () => Promise<void> }) {
  const [editando, setEditando] = useState(!atual.key);
  const [tipo, setTipo] = useState<PixType>((atual.type as PixType) ?? "cpf");
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErro("");
    const { error } = await supabaseBrowser().rpc("indicator_set_pix", { p_pix_type: tipo, p_pix_key: chave });
    setBusy(false);
    if (error) return setErro(error.message);
    setEditando(false); setChave("");
    await onSalvo();
  }
  if (!editando) return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm"><span className="text-muted">Você recebe por PIX em</span> <strong>{PIX_TYPES.find((p) => p.value === atual.type)?.label}: {atual.key}</strong></p>
      <button className={btn} onClick={() => setEditando(true)}>Trocar chave</button>
    </Card>
  );
  return (
    <Card className={destaque ? "border-2 border-accent" : ""}>
      <h2 className="font-semibold">{atual.key ? "Trocar chave PIX" : "Cadastre a chave PIX para receber"}</h2>
      <p className="mt-1 text-sm text-muted">As comissões são pagas por PIX no fim do mês. Sem a chave, o pagamento fica parado.</p>
      <form onSubmit={salvar} className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className="block text-sm font-medium">Tipo
          <select className={field} value={tipo} onChange={(e) => setTipo(e.target.value as PixType)}>{PIX_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Chave
          <input required className={field} value={chave} onChange={(e) => setChave(e.target.value)} />
        </label>
        <button type="submit" disabled={busy} className="min-h-12 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg disabled:opacity-60">{busy ? "Salvando…" : "Salvar"}</button>
      </form>
      <p className="mt-1 text-xs text-muted">{PIX_TYPES.find((p) => p.value === tipo)?.hint}</p>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      {atual.key && <button onClick={() => setEditando(false)} className="mt-2 text-sm text-brand underline">Cancelar</button>}
    </Card>
  );
}

function Confirmacoes({ lista, onRespondeu }: { lista: Pendente[]; onRespondeu: () => Promise<void> }) {
  const [erro, setErro] = useState("");
  async function responder(id: string, sim: boolean) {
    setErro("");
    const { error } = await supabaseBrowser().rpc("indicator_answer_declared", { p_referral: id, p_accept: sim });
    if (error) return setErro(error.message);
    await onRespondeu();
  }
  return (
    <Card className="border-2 border-amber-300">
      <h2 className="font-semibold">Você indicou estas pessoas?</h2>
      <p className="mt-1 text-sm text-muted">Elas disseram que foram indicadas por você. Confirme para a indicação contar como sua.</p>
      <ul className="mt-2 divide-y divide-line">
        {lista.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong>{p.friend}</strong> · {p.company_name} · {dataBR(p.created_at)}</span>
            <span className="flex gap-2">
              <button className="min-h-10 rounded-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-fg" onClick={() => responder(p.id, true)}>Sim, fui eu</button>
              <button className={btn} onClick={() => responder(p.id, false)}>Não conheço</button>
            </span>
          </li>
        ))}
      </ul>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
    </Card>
  );
}

/** Copiar e compartilhar o link de indicação no WhatsApp. */
export function Compartilhar({ empresa, link }: { empresa: string; link: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Conheço a ${empresa} e recomendo! Se precisar, peça um orçamento por este link: ${link}`;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-brand bg-[#1f8f4e] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
        <MessageCircle size={16} aria-hidden /> Compartilhar no WhatsApp
      </a>
      <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* link visível */ } }} className={btn}>
        {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
