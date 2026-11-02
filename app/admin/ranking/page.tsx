"use client";

import { useState } from "react";
import { Card, PageHeader, SaveNote } from "@/components/ui";
import { Toggle } from "@/components/Toggle";
import { ScoreEditor } from "@/components/admin/ScoreEditor";
import { BENEFITS, LEADERBOARD, TIERS, TIER_CRITERIA, type Benefit } from "@/lib/plataforma";

const inp = "w-full rounded-brand border border-line bg-white px-2 py-1.5 text-sm";

export default function RankingAdmin() {
  const [benefits, setBenefits] = useState<Benefit[]>(BENEFITS);
  const [saved, setSaved] = useState(false);
  const edit = (id: number, patch: Partial<Benefit>) => { setBenefits((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x))); setSaved(true); };
  const add = () => { setBenefits((b) => [...b, { id: Math.max(0, ...b.map((x) => x.id)) + 1, tier: "nivel1", title: "Novo benefício", description: "", active: false }]); setSaved(true); };
  return (
    <>
      <PageHeader title="Ranking de indicadores" subtitle="Quem indica sobe de nível por pontos e ganha benefícios. Os nomes dos níveis são provisórios: troque quando decidirem." />
      <ScoreEditor
        levelsTitle="Níveis do indicador"
        levels={TIERS}
        criteria={TIER_CRITERIA}
        defaultMetrics={{ closed_referrals: 3, confirmed_commissions: 2, companies_count: 2, months_active: 4 }}
        simTitle="Simulador: em que nível um indicador ficaria?"
        renderResult={(level, points, next) => (
          <div>
            <p className="text-sm text-muted">Nível</p>
            <p className="text-2xl font-semibold">{level?.name ?? "Sem nível"}</p>
            <p className="mt-1 text-xl tabular-nums">{points} pts</p>
            {next && <p className="mt-1 text-xs text-muted">Faltam {next.missing} pts para {next.name}</p>}
          </div>
        )}
      />

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Benefícios por nível</h2>
          <button onClick={add} className="rounded-brand border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">Adicionar benefício</button>
        </div>
        <p className="mt-1 text-sm text-muted">Quem chega num nível recebe os benefícios dele e dos níveis anteriores. Os de exemplo estão desativados até vocês decidirem.</p>
        <ul className="mt-4 space-y-3">
          {benefits.map((b) => (
            <li key={b.id} className={`grid gap-2 rounded-brand border border-line p-3 md:grid-cols-[9rem_1fr_2fr_auto] md:items-center ${b.active ? "" : "opacity-60"}`}>
              <select aria-label="Nível do benefício" className={inp} value={b.tier} onChange={(e) => edit(b.id, { tier: e.target.value })}>
                {TIERS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
              <input aria-label="Título do benefício" className={inp} value={b.title} onChange={(e) => edit(b.id, { title: e.target.value })} />
              <input aria-label="Descrição do benefício" className={inp} value={b.description} onChange={(e) => edit(b.id, { description: e.target.value })} />
              <Toggle on={b.active} onChange={(v) => edit(b.id, { active: v })} label={`Benefício ${b.title} ativo`} />
            </li>
          ))}
        </ul>
        <div className="mt-3"><SaveNote saved={saved} /></div>
      </Card>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="p-4 text-left text-lg font-semibold">Placar geral (exemplo)</caption>
          <thead className="bg-surface text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Posição</th><th className="px-4 py-2 font-medium">Indicador</th><th className="px-4 py-2 font-medium">Nível</th><th className="px-4 py-2 font-medium">Pontos</th></tr></thead>
          <tbody className="divide-y divide-line">
            {LEADERBOARD.map((r) => (
              <tr key={r.position}><td className="px-4 py-2 tabular-nums">{r.position}º</td><td className="px-4 py-2">{r.name}</td><td className="px-4 py-2">{r.tier}</td><td className="px-4 py-2 tabular-nums">{r.points}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="p-4 pt-2 text-xs text-muted">O nome só aparece para quem aceitou aparecer. Quem não aceitou entra como “Indicador anônimo”, por causa da LGPD.</p>
      </Card>
    </>
  );
}
