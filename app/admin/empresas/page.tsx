"use client";

import { useState } from "react";
import { Card, PageHeader, SaveNote } from "@/components/ui";
import { ADMIN_COMPANIES, GROUPS, PLANS, levelName } from "@/lib/plataforma";

const sel = "rounded-brand border border-line bg-white px-2 py-1.5 text-sm";

export default function EmpresasAdmin() {
  const [rows, setRows] = useState(ADMIN_COMPANIES);
  const [saved, setSaved] = useState(false);
  const set = (id: string, patch: Partial<(typeof rows)[number]>) => { setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x))); setSaved(true); };
  const blocked = (c: (typeof rows)[number], plan: (typeof PLANS)[number]) =>
    (plan.maxReferrers != null && c.referrers > plan.maxReferrers) || (plan.maxOffers != null && c.offers > plan.maxOffers) || (plan.maxMembers != null && c.members > plan.maxMembers);

  return (
    <>
      <PageHeader title="Empresas" subtitle="Defina o grupo e o plano de cada empresa. O plano só pode ser reduzido se a empresa já couber nos limites do plano menor." />
      <div className="space-y-4">
        {rows.map((c) => {
          const group = GROUPS.find((g) => g.code === c.group);
          const suggested = group?.planCode;
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <p className="text-sm text-muted">{c.referrers} indicadores · {c.offers} produtos · {c.members} usuários · {c.sales} vendas · selo {c.seal ? levelName(c.seal) : "ainda sem selo"} ({c.points} pts)</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label>Grupo<br />
                    <select className={sel} value={c.group} onChange={(e) => set(c.id, { group: e.target.value })}>
                      {GROUPS.filter((g) => g.active || g.code === c.group).map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
                    </select>
                  </label>
                  <label>Plano<br />
                    <select className={sel} value={c.plan} onChange={(e) => set(c.id, { plan: e.target.value })}>
                      {PLANS.map((p) => <option key={p.code} value={p.code} disabled={!p.active || blocked(c, p)}>{p.name}{!p.active ? " (desativado)" : blocked(c, p) ? " (não cabe)" : ""}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              {suggested && suggested !== c.plan && (
                <p className="mt-3 rounded-brand bg-amber-50 p-2 text-sm text-amber-900">
                  O grupo “{group?.name}” sugere o plano {PLANS.find((p) => p.code === suggested)?.name}. A empresa está no {PLANS.find((p) => p.code === c.plan)?.name}.
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <div className="mt-4"><SaveNote saved={saved} /></div>
    </>
  );
}
