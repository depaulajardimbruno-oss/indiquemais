"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

/** Mostra o link pessoal do indicador, com botões de copiar e de enviar por WhatsApp.
 *  O endereço usa o domínio do ambiente em que o site está (teste, homologação ou produção). */
export function ShareLink({ code, firstName, company }: { code: string; firstName: string; company: string }) {
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const [copied, setCopied] = useState(false);
  const link = `${origin}/i/${code}`;
  const text = `Fechei meu projeto com a ${company} e recomendo muito. Peça seu orçamento por aqui: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o link continua visível para copiar à mão */
    }
  }

  return (
    <div>
      <p className="text-sm opacity-90">Seu link pessoal, {firstName}</p>
      <p className="mt-1 break-all rounded-brand bg-white/15 px-3 py-2 font-mono text-sm" data-testid="my-link">
        {link || `/i/${code}`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-brand bg-white px-4 py-3 text-sm font-medium text-ink hover:opacity-90"
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-brand border border-white/60 px-4 py-3 text-sm font-medium hover:bg-white/10"
        >
          <MessageCircle size={16} aria-hidden />
          Enviar no WhatsApp
        </a>
      </div>
    </div>
  );
}
