"use client";

import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { brl, commissions as initial, shortDate, type Commission, type CommissionStatus } from "@/lib/mock";

const FILTERS: { key: "todas" | CommissionStatus; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "liberada", label: "A pagar" },
  { key: "pendente", label: "Em carência" },
  { key: "paga", label: "Pagas" },
  { key: "contestada", label: "Contestadas" },
];

export default function ComissoesPage() {
  const [items, setItems] = useState<Commission[]>(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todas");
  const [paying, setPaying] = useState<string | null>(null);
  const [proof, setProof] = useState<string>("");

  const shown = useMemo(
    () => (filter === "todas" ? items : items.filter((c) => c.status === filter)),
    [items, filter],
  );
  const toPay = items.filter((c) => c.status === "liberada").reduce((s, c) => s + c.amountCents, 0);

  function confirmPay(id: string) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status: "paga" } : c)));
    setPaying(null);
    setProof("");
  }

  return (
    <>
      <PageHeader
        title="Comissões"
        subtitle={`Você paga o indicador direto e registra aqui. A pagar agora: ${brl(toPay)}.`}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar comissões">
        {FILTERS.map((f) => {
          const count = f.key === "todas" ? items.length : items.filter((c) => c.status === f.key).length;
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                on ? "border-brand bg-brand text-brand-fg" : "border-line bg-white"
              }`}
            >
              {f.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <ul className="space-y-3">
        {shown.map((c) => (
          <li key={c.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.referrer}</p>
                  <p className="text-sm text-muted">
                    {c.offerName} · liberação em {shortDate(c.releaseDate)}
                  </p>
                  <p className="mt-1 text-xs text-muted">PIX: {c.pixKey}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums">{brl(c.amountCents)}</p>
                  <StatusBadge status={c.status} />
                </div>
              </div>

              {c.status === "liberada" && paying !== c.id && (
                <button
                  onClick={() => {
                    setPaying(c.id);
                    setProof("");
                  }}
                  className="mt-3 rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg hover:opacity-90"
                >
                  Registrar pagamento
                </button>
              )}

              {paying === c.id && (
                <div className="mt-3 rounded-brand bg-brand-soft p-3 text-sm">
                  <p className="mb-2">
                    Pague via PIX para a chave acima e anexe o comprovante. O indicador será avisado para confirmar.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 rounded-brand border border-dashed border-brand-line bg-white px-3 py-2">
                    <Paperclip size={16} aria-hidden />
                    <span className="truncate">{proof || "Anexar comprovante (PDF ou imagem)"}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => setProof(e.target.files?.[0]?.name ?? "")}
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={!proof}
                      onClick={() => confirmPay(c.id)}
                      className="rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg disabled:opacity-40"
                    >
                      Confirmar pagamento
                    </button>
                    <button
                      onClick={() => setPaying(null)}
                      className="rounded-brand border border-line bg-white px-4 py-3 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {c.status === "contestada" && (
                <p className="mt-3 rounded-brand bg-rose-50 p-3 text-sm text-rose-900">
                  O indicador contestou esta comissão. No sistema real, aqui você envia sua
                  resposta e o time do Indique Mais media o caso.
                </p>
              )}
            </Card>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-10 text-center text-sm text-muted">Nenhuma comissão neste filtro.</li>
        )}
      </ul>
    </>
  );
}
