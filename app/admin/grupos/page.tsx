"use client";

import { useState } from "react";
import { Card, PageHeader, SaveNote } from "@/components/ui";
import { Toggle } from "@/components/Toggle";
import { GROUPS, PLANS, ADMIN_COMPANIES, type Group } from "@/lib/plataforma";

const inp = "w-full rounded-brand border border-line bg-white px-2 py-1.5 text-sm";

export default function GruposAdmin() {
  const [groups, setGroups] = useState<Group[]>(GROUPS);
  const [saved, setSaved] = useState(false);
  const edit = (code: string, patch: Partial<Group>) => { setGroups((g) => g.map((x) => (x.code === code ? { ...x, ...patch } : x))); setSaved(true); };
  return (
    <>
      <PageHeader title="Grupos de cliente" subtitle="O grupo diz em que perfil a empresa se encaixa e qual plano combina com ela. A venda do plano fica mais fácil de explicar." />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => {
          const n = ADMIN_COMPANIES.filter((c) => c.group === g.code).length;
          return (
            <Card key={g.code} className={g.active ? "" : "opacity-60"}>
              <div className="flex items-start justify-between gap-3">
                <input aria-label={`Nome do grupo ${g.name}`} className={`${inp} text-base font-semibold`} value={g.name} onChange={(e) => edit(g.code, { name: e.target.value })} />
                <Toggle on={g.active} onChange={(v) => edit(g.code, { active: v })} label={`Grupo ${g.name} ativo`} />
              </div>
              <textarea aria-label={`Descrição do grupo ${g.name}`} className={`${inp} mt-3`} rows={2} value={g.description} onChange={(e) => edit(g.code, { description: e.target.value })} />
              <label className="mt-3 block text-sm font-medium">Plano sugerido
                <select className={`${inp} mt-1`} value={g.planCode} onChange={(e) => edit(g.code, { planCode: e.target.value })}>
                  {PLANS.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </label>
              <p className="mt-3 text-xs text-muted">{n} {n === 1 ? "empresa" : "empresas"} neste grupo</p>
            </Card>
          );
        })}
      </div>
      <div className="mt-4"><SaveNote saved={saved} /></div>
    </>
  );
}
