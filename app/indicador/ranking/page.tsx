"use client";

import { useState } from "react";
import { Lock, Check } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { Toggle } from "@/components/Toggle";
import { BENEFITS, LEADERBOARD, TIERS } from "@/lib/plataforma";

// Marina (indicadora de exemplo)
const POINTS = 95;
const MY = { closed: 3, confirmed: 2, companies: 2, months: 4 };

export default function RankingPage() {
  const [optIn, setOptIn] = useState(true);
  const tiers = TIERS.filter((t) => t.active);
  const idx = tiers.map((t) => t.minPoints <= POINTS).lastIndexOf(true);
  const cur = tiers[idx];
  const next = tiers[idx + 1];
  const pct = next ? Math.round(((POINTS - cur.minPoints) / (next.minPoints - cur.minPoints)) * 100) : 100;
  const benefits = BENEFITS.filter((b) => b.active);

  return (
    <>
      <PageHeader title="Seu ranking" subtitle="Quanto mais você indica e quanto mais indicações viram venda, mais você sobe e mais benefícios libera." />
      <Card className="bg-brand text-brand-fg">
        <p className="text-sm opacity-90">Seu nível</p>
        <p className="text-3xl font-semibold">{cur.name}</p>
        <p className="mt-1 text-sm opacity-90">{POINTS} pontos · 3º lugar entre {LEADERBOARD.length + 14} indicadores</p>
        {next && (
          <>
            <div className="mt-4 h-2 rounded-full bg-white/25" role="progressbar" aria-label="Progresso para o próximo nível" aria-valuenow={POINTS} aria-valuemin={cur.minPoints} aria-valuemax={next.minPoints}>
              <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm">Faltam {next.minPoints - POINTS} pontos para o {next.name}.</p>
          </>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">Como você ganhou seus pontos</h2>
        <ul className="mt-2 divide-y divide-line text-sm">
          <li className="flex justify-between py-2"><span>Indicações fechadas ({MY.closed})</span><span className="tabular-nums">+{MY.closed * 10}</span></li>
          <li className="flex justify-between py-2"><span>Comissões que você confirmou ({MY.confirmed})</span><span className="tabular-nums">+{MY.confirmed * 15}</span></li>
          <li className="flex justify-between py-2"><span>Empresas em que já vendeu ({MY.companies})</span><span className="tabular-nums">+{MY.companies * 20}</span></li>
          <li className="flex justify-between py-2"><span>Tempo de casa ({MY.months} meses)</span><span className="tabular-nums">+{MY.months * 3}</span></li>
        </ul>
        <p className="mt-2 text-xs text-muted">Dica: confirmar que recebeu cada comissão também dá pontos.</p>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Benefícios</h2>
      <ul className="space-y-2">
        {tiers.map((t, i) => {
          const list = benefits.filter((b) => b.tier === t.code);
          const unlocked = i <= idx;
          return (
            <li key={t.code}>
              <Card className={`p-4 ${unlocked ? "" : "opacity-70"}`}>
                <p className="flex items-center gap-2 font-medium">{unlocked ? <Check size={16} className="text-emerald-600" aria-hidden /> : <Lock size={16} className="text-muted" aria-hidden />}{t.name} <span className="text-xs font-normal text-muted">a partir de {t.minPoints} pontos</span></p>
                {list.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted">{list.map((b) => <li key={b.id}>{b.title}: {b.description}</li>)}</ul>
                ) : <p className="mt-1 text-sm text-muted">Benefícios em definição.</p>}
              </Card>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Classificação</h2>
      <Card className="p-0">
        <ol className="divide-y divide-line text-sm">
          {LEADERBOARD.map((r) => (
            <li key={r.position} className={`flex items-center justify-between gap-3 px-4 py-3 ${r.me ? "bg-brand-soft font-medium" : ""}`}>
              <span className="flex items-center gap-3"><span className="w-6 tabular-nums text-muted">{r.position}º</span>{r.me ? (optIn ? r.name : "Você (anônimo para os outros)") : r.name}</span>
              <span className="tabular-nums text-muted">{r.tier} · {r.me ? POINTS : r.points} pts</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="mt-3 flex items-start justify-between gap-4">
        <div><p className="font-medium">Aparecer com meu nome na classificação</p><p className="text-sm text-muted">Desligado, os outros indicadores veem você como “Indicador anônimo”. Aparece só o primeiro nome e a inicial do sobrenome.</p></div>
        <Toggle on={optIn} onChange={setOptIn} label="Aparecer com meu nome na classificação" />
      </Card>
    </>
  );
}
