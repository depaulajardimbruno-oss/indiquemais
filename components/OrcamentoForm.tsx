"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui";
import { PRODUCTS } from "@/lib/indicador";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

/** Formulário de pedido de orçamento do amigo indicado.
 *  - Veio pelo link: o indicador já vem preenchido e travado.
 *  - Não veio pelo link: o amigo informa quem indicou (nome e telefone), que será avisado para confirmar. */
export function OrcamentoForm({
  company,
  referrerFirstName,
}: {
  company: string;
  referrerFirstName?: string;
}) {
  const [sent, setSent] = useState(false);
  const [referrerName, setReferrerName] = useState("");
  const hasLink = Boolean(referrerFirstName);

  if (sent) {
    const who = hasLink ? referrerFirstName : referrerName.trim();
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto text-brand" size={40} aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">Pedido enviado</h2>
        <p className="mt-1 text-sm text-muted">
          A {company} vai entrar em contato para combinar a medição e o orçamento.
          {who ? ` ${who} será avisado(a) da indicação.` : ""}
        </p>
        <p className="mt-3 text-xs text-muted">Protótipo: nenhum dado foi enviado ou salvo.</p>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <Card className="space-y-4">
        <label className="block text-sm font-medium">
          Seu nome
          <input required autoComplete="name" className={input} placeholder="Nome e sobrenome" />
        </label>
        <label className="block text-sm font-medium">
          Seu telefone (WhatsApp)
          <input required type="tel" autoComplete="tel" className={input} placeholder="(00) 00000-0000" />
        </label>
        <label className="block text-sm font-medium">
          O que você quer orçar?
          <select required defaultValue="" className={input}>
            <option value="" disabled>
              Escolha uma opção
            </option>
            {PRODUCTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="space-y-4">
        {hasLink ? (
          <p className="text-sm">
            <span className="text-muted">Indicação de</span>{" "}
            <strong>{referrerFirstName}</strong>, cliente {company}.
          </p>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium">Alguém indicou a {company} para você?</p>
              <p className="text-xs text-muted">
                Se sim, informe quem. Essa pessoa recebe um aviso para confirmar. Pode deixar em branco.
              </p>
            </div>
            <label className="block text-sm font-medium">
              Nome de quem indicou
              <input
                className={input}
                value={referrerName}
                onChange={(e) => setReferrerName(e.target.value)}
                placeholder="Ex.: Marina Souza"
              />
            </label>
            <label className="block text-sm font-medium">
              Telefone de quem indicou
              <input type="tel" className={input} placeholder="(00) 00000-0000" />
            </label>
          </>
        )}
      </Card>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" required className="mt-0.5" />
        <span>
          Concordo que a {company} entre em contato comigo para o orçamento e que meus dados sejam
          usados para registrar quem me indicou.
        </span>
      </label>

      <button
        type="submit"
        className="w-full rounded-brand bg-brand px-5 py-3 text-sm font-medium text-brand-fg hover:opacity-90"
      >
        Pedir orçamento
      </button>
    </form>
  );
}
