"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { brl, calcCommission, describeRule, parseMoney, parsePercentBps, validateRule } from "@/lib/comissao";

const field =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

type Mode = "fixed" | "percent" | "mixed";
const MODES: [Mode, string][] = [
  ["fixed", "Valor fixo"],
  ["percent", "% do contrato"],
  ["mixed", "Fixo + %"],
];

export default function NovoProdutoPage() {
  const [mode, setMode] = useState<Mode>("percent");
  const [fixed, setFixed] = useState("");
  const [percent, setPercent] = useState("");
  const [hasCap, setHasCap] = useState(false);
  const [cap, setCap] = useState("");
  const [example, setExample] = useState("15000");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rule = {
    fixedCents: mode !== "percent" ? parseMoney(fixed) : null,
    percentBps: mode !== "fixed" ? parsePercentBps(percent) : null,
    capCents: hasCap ? parseMoney(cap) : null,
  };
  const exampleCents = parseMoney(example);
  const valid = validateRule(rule) === null;

  if (saved) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <CheckCircle2 className="mx-auto text-brand" size={40} aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Produto cadastrado</h1>
        <p className="mt-1 text-sm text-muted">
          Regra: {describeRule(rule)}. No sistema real, o produto fica ativo na hora, e mudar a
          comissão vale só para vendas novas: o que já foi vendido mantém o valor combinado.
          Neste protótipo, nada é salvo.
        </p>
        <Link
          href="/empresa/ofertas"
          className="mt-5 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg"
        >
          Voltar aos produtos
        </Link>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Novo produto" subtitle="Defina o que será indicado e como a comissão é calculada." />
      <form
        className="max-w-2xl space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const err = validateRule(rule);
          setError(err);
          if (!err) setSaved(true);
        }}
      >
        <Card className="space-y-4">
          <label className="block text-sm font-medium">
            Nome do produto
            <input required className={field} placeholder="Ex.: Box de banheiro" />
          </label>
          <label className="block text-sm font-medium">
            Descrição para o indicador
            <textarea required rows={3} className={field} placeholder="O que é, para quem serve e o que o indicador deve falar. Ex.: box sob medida, com instalação." />
          </label>
        </Card>

        <Card className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium">Como calcular a comissão</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {MODES.map(([v, label]) => (
                <label
                  key={v}
                  className={`cursor-pointer rounded-brand border px-3 py-2 text-center text-sm ${
                    mode === v ? "border-brand bg-brand-soft font-medium" : "border-line"
                  }`}
                >
                  <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mode !== "percent" && (
              <label className="block text-sm font-medium">
                Valor fixo por venda (R$)
                <input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} className={field} placeholder="100,00" />
              </label>
            )}
            {mode !== "fixed" && (
              <label className="block text-sm font-medium">
                Porcentagem do contrato total (%)
                <input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} className={field} placeholder="2" />
              </label>
            )}
            <label className="block text-sm font-medium">
              Carência antes de liberar (dias)
              <input required type="number" min="0" defaultValue={30} className={field} />
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={hasCap} onChange={(e) => setHasCap(e.target.checked)} />
              Definir um teto de comissão (opcional)
            </label>
            {hasCap && (
              <label className="mt-2 block text-sm font-medium">
                Teto por venda (R$)
                <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className={field} placeholder="800,00" />
              </label>
            )}
          </div>

          <div className="rounded-brand bg-brand-soft p-3 text-sm">
            <label className="block font-medium">
              Simule: contrato de R$
              <input inputMode="decimal" value={example} onChange={(e) => setExample(e.target.value)} className={`${field} max-w-40`} />
            </label>
            <p className="mt-2" aria-live="polite">
              {valid && exampleCents != null ? (
                <>
                  O indicador recebe <strong>{brl(calcCommission(rule, exampleCents))}</strong>
                  {rule.capCents != null && calcCommission({ ...rule, capCents: null }, exampleCents) > rule.capCents ? " (limitado pelo teto)" : ""}.
                </>
              ) : (
                "Preencha a regra para ver o resultado."
              )}
            </p>
          </div>

          <p className="text-xs text-muted">
            A porcentagem incide sobre o valor total do contrato. A comissão só é liberada depois
            que a obra for instalada e o prazo de carência passar, para cobrir cancelamentos.
          </p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </Card>

        <div className="flex gap-3">
          <button type="submit" className="rounded-brand bg-brand px-5 py-2 text-sm font-medium text-brand-fg hover:opacity-90">
            Salvar produto
          </button>
          <Link href="/empresa/ofertas" className="rounded-brand border border-line px-5 py-2 text-sm">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
