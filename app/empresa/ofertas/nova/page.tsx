"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

const field =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

export default function NovaOfertaPage() {
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [saved, setSaved] = useState(false);

  if (saved) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <CheckCircle2 className="mx-auto text-brand" size={40} aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Oferta enviada para aprovação</h1>
        <p className="mt-1 text-sm text-muted">
          No sistema real, o time do Indique Aí revisa a oferta antes de ela aparecer para os
          indicadores. Neste protótipo, nada é salvo.
        </p>
        <Link
          href="/empresa/ofertas"
          className="mt-5 inline-block rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
        >
          Voltar às ofertas
        </Link>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Nova oferta" subtitle="Defina o que será indicado e quanto o indicador ganha." />
      <form
        className="max-w-2xl space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
      >
        <Card className="space-y-4">
          <label className="block text-sm font-medium">
            Nome da oferta
            <input required className={field} placeholder="Ex.: Box de banheiro" />
          </label>
          <label className="block text-sm font-medium">
            Descrição para o indicador
            <textarea required rows={3} className={field} placeholder="O que é, para quem serve e o que o indicador deve falar. Ex.: box sob medida, com instalação." />
          </label>
          <label className="block text-sm font-medium">
            Endereço de destino (para onde o link leva)
            <input required type="url" className={field} placeholder="https://suaempresa.com.br/oferta" />
          </label>
        </Card>

        <Card className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium">Tipo de comissão</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["percent", "Percentual da venda"],
                  ["fixed", "Valor fixo"],
                ] as const
              ).map(([v, label]) => (
                <label
                  key={v}
                  className={`cursor-pointer rounded-brand border px-3 py-2 text-center text-sm ${
                    type === v ? "border-brand bg-brand-soft font-medium" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={v}
                    checked={type === v}
                    onChange={() => setType(v)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {type === "percent" ? "Percentual (%)" : "Valor (R$)"}
              <input required type="number" min="0" step="0.01" className={field} placeholder={type === "percent" ? "10" : "300,00"} />
            </label>
            <label className="block text-sm font-medium">
              Carência antes de liberar (dias)
              <input required type="number" min="0" defaultValue={15} className={field} />
            </label>
          </div>
          <p className="text-xs text-muted">
            A comissão só fica liberada para pagamento depois da carência, para cobrir
            devoluções e cancelamentos.
          </p>
        </Card>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-brand bg-brand px-5 py-2 text-sm font-medium text-brand-fg hover:opacity-90"
          >
            Enviar para aprovação
          </button>
          <Link href="/empresa/ofertas" className="rounded-brand border border-line px-5 py-2 text-sm">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
