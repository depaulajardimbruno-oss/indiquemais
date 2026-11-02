"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { me, myCommissions, STATUS_INFO, type MyCommission } from "@/lib/indicador";
import { brl } from "@/lib/mock";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

export default function ComissoesIndicadorPage() {
  const [items, setItems] = useState<MyCommission[]>(myCommissions);
  const [pix, setPix] = useState(me.pix);
  const [editingPix, setEditingPix] = useState(false);
  const [draftPix, setDraftPix] = useState("");

  const set = (id: string, status: MyCommission["status"], note: string) =>
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status, note } : c)));

  const toReceive = items
    .filter((c) => c.status !== "confirmada" && c.status !== "contestada")
    .reduce((s, c) => s + c.amountCents, 0);

  return (
    <>
      <PageHeader title="Minhas comissões" subtitle={`A receber: ${brl(toReceive)}`} />

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Chave PIX para receber</p>
            <p className="truncate font-medium">{pix}</p>
          </div>
          {!editingPix && (
            <button
              onClick={() => {
                setDraftPix("");
                setEditingPix(true);
              }}
              className="shrink-0 rounded-brand border border-line px-3 py-1.5 text-sm"
            >
              Trocar
            </button>
          )}
        </div>
        {editingPix && (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (draftPix.trim()) setPix(draftPix.trim());
              setEditingPix(false);
            }}
          >
            <label className="block text-sm font-medium">
              Nova chave PIX
              <input
                className={input}
                value={draftPix}
                onChange={(e) => setDraftPix(e.target.value)}
                placeholder="E-mail, telefone, CPF ou chave aleatória"
                autoFocus
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditingPix(false)}
                className="rounded-brand border border-line px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
        <p className="mt-3 text-xs text-muted">
          A {me.company} paga direto na sua chave. Confira sempre se é a sua antes de indicar.
        </p>
      </Card>

      <ul className="space-y-3">
        {items.map((c) => {
          const s = STATUS_INFO[c.status];
          return (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.friend}</p>
                    <p className="text-sm text-muted">{c.offer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{brl(c.amountCents)}</p>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">{c.note}</p>

                {c.status === "paga" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => set(c.id, "confirmada", "Você confirmou o recebimento.")}
                      className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90"
                    >
                      Recebi
                    </button>
                    <button
                      onClick={() =>
                        set(
                          c.id,
                          "contestada",
                          "Você avisou que não recebeu. No sistema real, o time do Indique Mais media o caso com a empresa.",
                        )
                      }
                      className="rounded-brand border border-line px-4 py-2 text-sm"
                    >
                      Não recebi
                    </button>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
