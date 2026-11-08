"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { brl, calcCommission, describeRule, parseMoney } from "@/lib/comissao";
import { onlyDigits } from "@/lib/cadastro";
import { COMISSAO, ETAPA, Selo, dataBR } from "@/lib/rotulos";
import { useEmpresa } from "@/components/empresa/EmpresaContext";

type Ref = {
  id: string; offer_name: string; friend_name: string; friend_phone: string; stage: string; source: string;
  sale_value_cents: number | null; contract_number: string | null; created_at: string; stage_changed_at: string;
  referrer_name: string | null; referrer_code: string | null; referrer_phone: string | null;
  declared_referrer_name: string | null; awaiting_referrer_confirmation: boolean; referrer_not_found: boolean;
  rule_fixed_cents: number | null; rule_percent_bps: number | null; rule_cap_cents: number | null; rule_grace_days: number | null;
  commission_cents: number | null; commission_status: string | null; release_date: string | null;
};

const ABAS = [
  ["novas", "Novas", ["indicado"]],
  ["orcamento", "Orçamento enviado", ["orcamento"]],
  ["fechou", "Fechadas", ["fechou"]],
  ["instalada", "Instaladas", ["instalada", "paga"]],
  ["perdido", "Perdidas", ["perdido"]],
] as const;
type Aba = (typeof ABAS)[number][0];

const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";
const primary = "inline-flex min-h-10 items-center justify-center rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";
const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const dias = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const wa = (phone: string | null, text: string) => {
  const d = onlyDigits(phone ?? "").slice(-11);
  return d.length >= 10 ? `https://wa.me/55${d}?text=${encodeURIComponent(text)}` : null;
};

export function Indicacoes() {
  const { empresa } = useEmpresa();
  const [lista, setLista] = useState<Ref[] | null>(null);
  const [aba, setAba] = useState<Aba>("novas");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().from("company_referrals").select("*").eq("company_id", empresa.id).order("created_at", { ascending: false });
    setLista((data ?? []) as Ref[]);
  }, [empresa.id]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const contagem = useMemo(() => Object.fromEntries(ABAS.map(([k, , st]) => [k, (lista ?? []).filter((r) => (st as readonly string[]).includes(r.stage)).length])), [lista]);
  const visiveis = useMemo(() => {
    const st = ABAS.find((a) => a[0] === aba)![2] as readonly string[];
    const q = busca.trim().toLowerCase();
    return (lista ?? []).filter((r) => st.includes(r.stage) && (!q || [r.friend_name, r.friend_phone, r.offer_name, r.referrer_name ?? "", r.contract_number ?? ""].some((v) => v.toLowerCase().includes(q))));
  }, [lista, aba, busca]);

  return (
    <>
      <PageHeader title="Indicações" subtitle="Pedidos de orçamento que chegaram por indicação. Avance cada um conforme o atendimento: é isso que gera a comissão do indicador." />
      <div role="tablist" aria-label="Etapas" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {ABAS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${aba === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>
            {l} {lista && <span className={`ml-1 rounded-full px-1.5 text-xs ${k === "novas" && contagem[k] > 0 ? "bg-accent text-ink" : "bg-surface"}`}>{contagem[k]}</span>}
          </button>
        ))}
      </div>
      <label className="relative mb-4 block sm:max-w-80">
        <span className="sr-only">Buscar</span>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, telefone, produto ou contrato" className="w-full rounded-brand border border-line bg-white py-2 pl-9 pr-3 text-sm" />
      </label>
      {lista === null && <p role="status" className="text-sm text-muted">Carregando…</p>}
      {lista && visiveis.length === 0 && (
        <Card className="text-center text-sm text-muted">
          {aba === "novas" ? "Nenhum pedido novo. Quando um amigo de um indicador pedir orçamento pelo link, ele aparece aqui." : "Nada nesta etapa."}
        </Card>
      )}
      <ul className="space-y-3">
        {visiveis.map((r) => <Item key={r.id} r={r} empresaNome={empresa.name} onMudou={carregar} />)}
      </ul>
    </>
  );
}

function Item({ r, empresaNome, onMudou }: { r: Ref; empresaNome: string; onMudou: () => Promise<void> }) {
  const [modo, setModo] = useState<null | "fechar" | "perder">(null);
  const [valor, setValor] = useState("");
  const [contrato, setContrato] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const regra = { fixedCents: r.rule_fixed_cents, percentBps: r.rule_percent_bps, capCents: r.rule_cap_cents };
  const valorCents = parseMoney(valor);
  const first = r.friend_name.split(" ")[0];
  const linkCliente = wa(r.friend_phone, `Olá, ${first}! Aqui é da ${empresaNome}. Recebemos o seu pedido de orçamento de ${r.offer_name}${r.referrer_name ? `, indicado por ${r.referrer_name.split(" ")[0]}` : ""}. Podemos conversar?`);

  async function mudar(stage: string, extra: { valor?: number | null; contrato?: string; nota?: string } = {}) {
    setBusy(true); setErro("");
    const { error } = await supabaseBrowser().rpc("company_set_referral_stage", {
      p_referral: r.id, p_stage: stage, p_sale_value_cents: extra.valor ?? null, p_contract_number: extra.contrato ?? null, p_note: extra.nota ?? null,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    setModo(null);
    await onMudou();
  }

  const semIndicador = r.referrer_not_found || r.awaiting_referrer_confirmation;
  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{r.friend_name} <span className="font-normal text-muted">· {r.offer_name}</span></p>
            <p className="text-sm text-muted">{r.friend_phone} · pediu em {dataBR(r.created_at)}{r.stage !== "perdido" ? ` · ${dias(r.stage_changed_at)} dia(s) nesta etapa` : ""}</p>
            <p className="mt-1 text-sm">
              {r.referrer_name ? <>Indicado por <strong>{r.referrer_name}</strong> <span className="font-mono text-xs text-muted">{r.referrer_code}</span></>
                : r.declared_referrer_name ? <span className="text-amber-700">Disse que foi indicado por {r.declared_referrer_name}</span> : <span className="text-muted">Sem indicador</span>}
              {r.awaiting_referrer_confirmation && <span className="text-amber-700"> · aguardando o indicador confirmar</span>}
            </p>
          </div>
          <Selo texto={ETAPA[r.stage]?.label ?? r.stage} cls={ETAPA[r.stage]?.cls ?? ""} />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-brand bg-surface p-3 text-sm">
          {r.commission_cents != null ? (
            <span>Comissão de <strong>{brl(r.commission_cents)}</strong> · venda {brl(r.sale_value_cents ?? 0)} · contrato {r.contract_number}</span>
          ) : (
            <span className="text-muted">Comissão combinada: {describeRule(regra)}</span>
          )}
          {r.commission_status && <Selo texto={COMISSAO[r.commission_status]?.label ?? r.commission_status} cls={COMISSAO[r.commission_status]?.cls ?? ""} />}
        </div>
        {r.stage === "instalada" && r.release_date && r.commission_status === "pendente" && (
          <p className="mt-2 text-xs text-muted">A comissão fica liberada em {dataBR(r.release_date)}, depois da carência de {r.rule_grace_days} dias.</p>
        )}

        {modo === null && !["instalada", "paga", "perdido"].includes(r.stage) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {linkCliente && r.stage !== "fechou" && <a href={linkCliente} target="_blank" rel="noreferrer" className={btn}><MessageCircle size={16} aria-hidden /> Chamar no WhatsApp</a>}
            {r.stage === "indicado" && <button className={primary} disabled={busy} onClick={() => mudar("orcamento")}>Orçamento enviado</button>}
            {r.stage === "orcamento" && <button className={primary} disabled={busy || semIndicador} onClick={() => setModo("fechar")}>Fechou negócio</button>}
            {r.stage === "fechou" && <button className={primary} disabled={busy} onClick={() => { if (confirm(`Confirmar que o serviço de ${first} foi instalado e pago? A comissão é liberada depois de ${r.rule_grace_days} dias.`)) void mudar("instalada"); }}>Instalado e pago pelo cliente</button>}
            <button className={btn} disabled={busy} onClick={() => setModo("perder")}>Não fechou</button>
          </div>
        )}
        {semIndicador && r.stage === "orcamento" && modo === null && <p className="mt-2 text-xs text-amber-700">Para fechar, o indicador precisa estar confirmado.</p>}

        {modo === "fechar" && (
          <form onSubmit={(e) => { e.preventDefault(); if (!valorCents) return setErro("Informe o valor total do contrato."); if (!contrato.trim()) return setErro("Informe o número do contrato ou pedido."); void mudar("fechou", { valor: valorCents, contrato }); }}
            className="mt-3 rounded-brand border border-line p-3">
            <p className="text-sm font-medium">Registrar a venda</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">Valor total do contrato (R$)<input inputMode="decimal" className={field} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="18.500,00" autoFocus /></label>
              <label className="block text-sm">Nº do contrato ou pedido<input className={field} value={contrato} onChange={(e) => setContrato(e.target.value)} placeholder="Como está no seu sistema" /></label>
            </div>
            <p className="mt-2 text-sm" aria-live="polite">{valorCents ? <>{r.referrer_name?.split(" ")[0] ?? "O indicador"} vai receber <strong>{brl(calcCommission(regra, valorCents))}</strong> ({describeRule(regra)}).</> : "Digite o valor para ver a comissão."}</p>
            <div className="mt-3 flex gap-2">
              <button type="submit" className={primary} disabled={busy}>{busy ? "Salvando…" : "Confirmar venda"}</button>
              <button type="button" className={btn} onClick={() => setModo(null)}>Cancelar</button>
            </div>
          </form>
        )}
        {modo === "perder" && (
          <form onSubmit={(e) => { e.preventDefault(); void mudar("perdido", { nota: motivo || undefined }); }} className="mt-3 rounded-brand border border-line p-3">
            <label className="block text-sm font-medium">Por que não fechou? (opcional, fica no histórico)
              <input className={field} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: achou caro, desistiu da obra" autoFocus />
            </label>
            {r.commission_cents != null && <p className="mt-2 text-sm text-amber-800">A comissão de {brl(r.commission_cents)} será cancelada.</p>}
            <div className="mt-3 flex gap-2">
              <button type="submit" className="inline-flex min-h-10 items-center rounded-brand bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>Marcar como perdida</button>
              <button type="button" className={btn} onClick={() => setModo(null)}>Cancelar</button>
            </div>
          </form>
        )}
        {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      </Card>
    </li>
  );
}
