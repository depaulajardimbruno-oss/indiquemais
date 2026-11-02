"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { brl, calcCommission, describeRule, parseMoney, type CommissionRule } from "@/lib/comissao";

type Stage = "novo" | "contato" | "orcamento" | "fechou" | "instalado" | "perdido";
const STAGES: [Stage, string][] = [
  ["novo", "Novo"],
  ["contato", "Em contato"],
  ["orcamento", "Orçamento enviado"],
  ["fechou", "Fechou"],
  ["instalado", "Obra instalada"],
  ["perdido", "Não fechou"],
];

type Row = {
  id: string;
  friend: string;
  product: string;
  rule: CommissionRule;
  referrer: string | null; // null = indicador não identificado
  confirmed: boolean;
  stage: Stage;
  contract?: string;
  valueCents?: number;
};

const SEED: Row[] = [
  { id: "r1", friend: "Carla Dias", product: "Sacada de vidro", rule: { fixedCents: 10000, percentBps: 200, capCents: 80000 }, referrer: "Marina Alves", confirmed: true, stage: "orcamento" },
  { id: "r2", friend: "Paulo Reis", product: "Box de banheiro", rule: { fixedCents: 30000, percentBps: null, capCents: null }, referrer: "Marina Alves", confirmed: false, stage: "contato" },
  { id: "r3", friend: "Ana Lima", product: "Guarda-corpo", rule: { fixedCents: null, percentBps: 500, capCents: 50000 }, referrer: null, confirmed: false, stage: "novo" },
];

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

export default function IndicacoesPage() {
  const [rows, setRows] = useState(SEED);
  const [closing, setClosing] = useState<Row | null>(null);
  const [value, setValue] = useState("");
  const [contract, setContract] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valueCents = parseMoney(value);

  function change(r: Row, stage: Stage) {
    if (stage === "fechou") {
      setClosing(r);
      setValue("");
      setContract("");
      setError(null);
      return;
    }
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, stage } : x)));
  }

  function confirmClose() {
    if (!closing) return;
    if (!valueCents || valueCents <= 0) return setError("Informe o valor total do contrato.");
    if (!contract.trim()) return setError("Informe o número do contrato ou pedido do seu sistema.");
    if (rows.some((x) => x.contract?.toUpperCase() === contract.trim().toUpperCase()))
      return setError("Esse número de contrato já foi usado em outra indicação.");
    setRows((rs) =>
      rs.map((x) => (x.id === closing.id ? { ...x, stage: "fechou", valueCents, contract: contract.trim() } : x)),
    );
    setClosing(null);
  }

  return (
    <>
      <PageHeader
        title="Indicações"
        subtitle="Atualize a etapa de cada indicação. Ao marcar “Fechou”, informe o contrato: é ele que gera a comissão."
      />

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.friend}</p>
                  <p className="text-sm text-muted">
                    {r.product} · {describeRule(r.rule)}
                  </p>
                  <p className="mt-1 text-sm">
                    Indicado por: {r.referrer ?? <span className="text-red-700">não identificado, vincule o indicador</span>}
                  </p>
                  {r.referrer && !r.confirmed && (
                    <p className="text-xs text-muted">Aguardando o indicador confirmar que fez essa indicação. Só depois dá para fechar.</p>
                  )}
                  {r.stage === "fechou" || r.stage === "instalado" ? (
                    <p className="mt-1 text-sm">
                      Contrato {r.contract} · {brl(r.valueCents ?? 0)} · comissão{" "}
                      <strong>{brl(calcCommission(r.rule, r.valueCents ?? 0))}</strong>
                    </p>
                  ) : null}
                </div>
                <label className="text-sm font-medium">
                  Etapa
                  <select
                    className={field}
                    value={r.stage}
                    disabled={r.stage === "fechou" || r.stage === "instalado" ? r.stage === "instalado" : false}
                    onChange={(e) => change(r, e.target.value as Stage)}
                  >
                    {STAGES.map(([v, l]) => (
                      <option key={v} value={v} disabled={v === "fechou" && (!r.referrer || !r.confirmed)}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {closing && (
        <div role="dialog" aria-modal="true" aria-labelledby="fechar-titulo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-4">
            <h2 id="fechar-titulo" className="text-lg font-semibold">Fechar venda de {closing.friend}</h2>
            <label className="block text-sm font-medium">
              Valor total do contrato (R$)
              <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={field} placeholder="15.000,00" />
            </label>
            <label className="block text-sm font-medium">
              Número do contrato ou pedido (do seu sistema)
              <input value={contract} onChange={(e) => setContract(e.target.value)} className={field} placeholder="Ex.: PED-2026-0412" />
            </label>
            <p className="rounded-brand bg-brand-soft p-3 text-sm" aria-live="polite">
              {valueCents
                ? <>Comissão do indicador: <strong>{brl(calcCommission(closing.rule, valueCents))}</strong></>
                : "Informe o valor para ver a comissão."}
            </p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-3">
              <button onClick={confirmClose} className="rounded-brand bg-brand px-5 py-2 text-sm font-medium text-brand-fg">Registrar venda</button>
              <button onClick={() => setClosing(null)} className="rounded-brand border border-line px-5 py-2 text-sm">Cancelar</button>
            </div>
            <p className="text-xs text-muted">Depois de registrada, só dá para corrigir o valor com um motivo, e apenas enquanto a comissão estiver pendente.</p>
          </Card>
        </div>
      )}
    </>
  );
}
