"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { maskPhone, onlyDigits } from "@/lib/cadastro";

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const CONSENT_VERSION = "orcamento-v1";
type Info = { company_name: string; referrer_first_name: string; offers: { id: string; name: string; description: string | null }[]; company_phone: string | null };

/** Página do link de indicação: o amigo pede orçamento e a indicação fica registrada para quem indicou. */
export function PedidoOrcamento({ code }: { code: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(hasSupabase ? undefined : null);
  const [f, setF] = useState({ name: "", phone: "", offer: "", consent: false });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!hasSupabase) return;
    supabaseBrowser().rpc("referral_link_info", { p_code: code }).then(({ data }) => {
      const row = Array.isArray(data) ? (data[0] as Info | undefined) : undefined;
      setInfo(row ?? null);
      if (row?.offers.length === 1) setF((p) => ({ ...p, offer: row.offers[0].id }));
    });
  }, [code]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 3) return setErro("Informe o seu nome.");
    if (onlyDigits(f.phone).length < 10) return setErro("Informe o telefone com DDD.");
    if (!f.offer) return setErro("Escolha o que você quer orçar.");
    if (!f.consent) return setErro("Marque a autorização para a empresa entrar em contato.");
    setErro(""); setEnviando(true);
    const { error } = await supabaseBrowser().rpc("submit_quote_request", {
      p_friend_name: f.name, p_friend_phone: f.phone, p_offer_id: f.offer, p_consent: true, p_consent_version: CONSENT_VERSION, p_code: code,
    });
    setEnviando(false);
    if (error) return setErro(error.message);
    setEnviado(true);
  }

  if (info === undefined) return <Card><p role="status" className="text-sm text-muted">Abrindo…</p></Card>;
  if (info === null) return (
    <Card className="text-center">
      <XCircle className="mx-auto text-rose-600" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Link de indicação indisponível</h1>
      <p className="mt-1 text-sm text-muted">Este código não existe ou está pausado. Confira com quem te mandou o link.</p>
    </Card>
  );
  if (enviado) {
    const produto = info.offers.find((o) => o.id === f.offer)?.name ?? "o orçamento";
    const tel = onlyDigits(info.company_phone ?? "").slice(-11);
    const zap = tel.length >= 10 ? `https://wa.me/55${tel}?text=${encodeURIComponent(`Olá! Sou ${f.name.split(" ")[0]}, ${info.referrer_first_name} me indicou e acabei de pedir orçamento de ${produto} pelo Indiki+.`)}` : null;
    return (
      <Card>
        <div className="text-center">
          <CheckCircle2 className="mx-auto text-emerald-600" size={44} aria-hidden />
          <h1 className="mt-3 text-2xl font-semibold">Pedido enviado</h1>
          <p className="mt-1 text-sm text-muted">Obrigado, {f.name.split(" ")[0]}! Seu pedido de {produto} chegou na {info.company_name}.</p>
        </div>
        <ol className="mt-5 space-y-3 text-sm">
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-fg">1</span><span>A {info.company_name} vai te chamar no WhatsApp <strong>{f.phone}</strong> para entender o que você precisa.</span></li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-fg">2</span><span>Você recebe o orçamento sem compromisso.</span></li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-fg">3</span><span>Se você fechar, {info.referrer_first_name} recebe da empresa uma comissão por ter indicado.</span></li>
        </ol>
        {zap && (
          <a href={zap} target="_blank" rel="noreferrer" className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-brand bg-[#1f8f4e] px-4 py-3 text-sm font-semibold text-white hover:opacity-90">
            <MessageCircle size={16} aria-hidden /> Falar agora com a {info.company_name}
          </a>
        )}
      </Card>
    );
  }
  if (info.offers.length === 0) return (
    <Card className="text-center">
      <h1 className="text-xl font-semibold">{info.referrer_first_name} indicou a {info.company_name}</h1>
      <p className="mt-1 text-sm text-muted">A empresa ainda não abriu produtos para pedido de orçamento por aqui. Tente de novo mais tarde.</p>
    </Card>
  );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{info.referrer_first_name} indicou a {info.company_name} para você</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Peça seu orçamento sem compromisso. Leva menos de um minuto.</p>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Card className="space-y-4">
          <label className="block text-sm font-medium">Seu nome
            <input required autoComplete="name" className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" />
          </label>
          <label className="block text-sm font-medium">Seu telefone (WhatsApp)
            <input required type="tel" autoComplete="tel" className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">O que você quer orçar?</legend>
            <div className="mt-2 space-y-2">
              {info.offers.map((o) => (
                <label key={o.id} className={`block cursor-pointer rounded-brand border p-3 text-sm ${f.offer === o.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="offer" value={o.id} checked={f.offer === o.id} onChange={() => setF({ ...f, offer: o.id })} /> {o.name}
                  </span>
                  {o.description && <span className="mt-1 block pl-6 text-muted">{o.description}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          <span>Autorizo a {info.company_name} a entrar em contato comigo para o orçamento e o uso dos meus dados para registrar quem me indicou.</span>
        </label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <button type="submit" disabled={enviando} className="min-h-12 w-full rounded-brand bg-brand px-5 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{enviando ? "Enviando…" : "Pedir orçamento"}</button>
      </form>
    </>
  );
}
