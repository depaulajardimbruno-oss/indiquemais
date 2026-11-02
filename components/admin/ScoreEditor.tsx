"use client";

import { useState, type ReactNode } from "react";
import { Card, SaveNote } from "@/components/ui";
import { Toggle } from "@/components/Toggle";
import { calcPoints, type Criterion } from "@/lib/plataforma";

export type Level = { code: string; name: string; minPoints: number; minSales?: number; active: boolean };

const inp = "w-24 rounded-brand border border-line bg-white px-2 py-1.5 text-sm tabular-nums";
const num = (v: string, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };

/** Editor de pontuação: níveis (com mínimos), critérios (pesos) e um simulador que usa as mesmas contas do banco. */
export function ScoreEditor({
  levelsTitle, levels: l0, criteria: c0, salesKey, defaultMetrics, simTitle, renderResult,
}: {
  levelsTitle: string;
  levels: Level[];
  criteria: Criterion[];
  salesKey?: string; // critério que conta as vendas para o mínimo de vendas do nível
  defaultMetrics: Record<string, number>;
  simTitle: string;
  renderResult: (level: Level | null, points: number, next: { name: string; missing: number } | null) => ReactNode;
}) {
  const [levels, setLevels] = useState(l0);
  const [criteria, setCriteria] = useState(c0);
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [saved, setSaved] = useState(false);

  const editL = (code: string, patch: Partial<Level>) => { setLevels((l) => l.map((x) => (x.code === code ? { ...x, ...patch } : x))); setSaved(true); };
  const editC = (code: string, patch: Partial<Criterion>) => { setCriteria((c) => c.map((x) => (x.code === code ? { ...x, ...patch } : x))); setSaved(true); };

  const points = calcPoints(metrics, criteria);
  const sales = salesKey ? metrics[salesKey] ?? 0 : 0;
  const reached = levels.filter((l) => l.active && points >= l.minPoints && sales >= (l.minSales ?? 0));
  const current = reached.length ? reached[reached.length - 1] : null;
  const above = levels.filter((l) => l.active && (!current || l.minPoints > current.minPoints));
  const nextLevel = above.length ? above[0] : null;
  const next = nextLevel ? { name: nextLevel.name, missing: Math.max(nextLevel.minPoints - points, 0) } : null;

  return (
    <div className="space-y-6">
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="p-4 text-left text-lg font-semibold">{levelsTitle}</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Nível</th>
              <th className="px-4 py-2 font-medium">Pontos mínimos</th>
              {levels.some((l) => l.minSales !== undefined) && <th className="px-4 py-2 font-medium">Vendas mínimas</th>}
              <th className="px-4 py-2 font-medium">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {levels.map((l) => (
              <tr key={l.code} className={l.active ? "" : "opacity-60"}>
                <td className="px-4 py-2"><input aria-label={`Nome do nível ${l.name}`} className="w-36 rounded-brand border border-line bg-white px-2 py-1.5 text-sm font-medium" value={l.name} onChange={(e) => editL(l.code, { name: e.target.value })} /></td>
                <td className="px-4 py-2"><input aria-label={`Pontos mínimos de ${l.name}`} className={inp} inputMode="numeric" value={l.minPoints} onChange={(e) => editL(l.code, { minPoints: num(e.target.value) })} /></td>
                {l.minSales !== undefined && <td className="px-4 py-2"><input aria-label={`Vendas mínimas de ${l.name}`} className={inp} inputMode="numeric" value={l.minSales} onChange={(e) => editL(l.code, { minSales: num(e.target.value) })} /></td>}
                <td className="px-4 py-2"><Toggle on={l.active} onChange={(v) => editL(l.code, { active: v })} label={`Nível ${l.name} ativo`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="p-4 text-left text-lg font-semibold">O que conta pontos</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr><th className="px-4 py-2 font-medium">Critério</th><th className="px-4 py-2 font-medium">Pontos por unidade</th><th className="px-4 py-2 font-medium">Teto de pontos</th><th className="px-4 py-2 font-medium">Ativo</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {criteria.map((c) => (
              <tr key={c.code} className={c.active ? "" : "opacity-60"}>
                <td className="px-4 py-2"><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.description}</p></td>
                <td className="px-4 py-2"><input aria-label={`Pontos por unidade: ${c.name}`} className={inp} inputMode="numeric" value={c.weight} onChange={(e) => editC(c.code, { weight: num(e.target.value) })} /></td>
                <td className="px-4 py-2"><input aria-label={`Teto de pontos: ${c.name}`} className={inp} inputMode="numeric" placeholder="sem teto" value={c.max ?? ""} onChange={(e) => editC(c.code, { max: e.target.value.trim() === "" ? null : Math.max(1, num(e.target.value, 1)) })} /></td>
                <td className="px-4 py-2"><Toggle on={c.active} onChange={(v) => editC(c.code, { active: v })} label={`Critério ${c.name} ativo`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{simTitle}</h2>
        <p className="text-sm text-muted">Mexa nos números para ver como as regras acima se comportam. É a mesma conta que o sistema faz.</p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-2">
            {criteria.map((c) => (
              <label key={c.code} className={`text-sm ${c.active ? "" : "opacity-50"}`}>
                {c.name}
                <input className="mt-1 block w-full rounded-brand border border-line bg-white px-2 py-1.5 text-sm tabular-nums" inputMode="numeric"
                  value={metrics[c.code] ?? 0} onChange={(e) => setMetrics((m) => ({ ...m, [c.code]: Math.max(0, num(e.target.value)) }))} />
              </label>
            ))}
          </div>
          <div className="min-w-48 rounded-brand bg-brand-soft p-4 text-center" aria-live="polite">{renderResult(current, points, next)}</div>
        </div>
      </Card>
      <SaveNote saved={saved} />
    </div>
  );
}
