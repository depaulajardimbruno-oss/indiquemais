"use client";

import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { GROUPS, PLANS, REPORT_LABEL, SUPPORT_LABEL, type Plan } from "@/lib/plataforma";

// Soulglass (empresa piloto): uso atual
const USAGE = { referrers: 18, offers: 4, members: 2 };
const CURRENT = "avancado";
const GROUP = "media";

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const near = max != null && used / max >= 0.8;
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted">{used} de {max ?? "ilimitado"}</span></div>
      <div className="mt-1 h-2 rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max ?? used}>
        <div className={`h-2 rounded-full ${near ? "bg-accent" : "bg-brand"}`} style={{ width: max ? `${pct}%` : "8%" }} />
      </div>
      {near && <p className="mt-1 text-xs text-amber-800">Perto do limite do plano.</p>}
    </div>
  );
}

const fits = (p: Plan) =>
  (p.maxReferrers == null || USAGE.referrers <= p.maxReferrers) && (p.maxOffers == null || USAGE.offers <= p.maxOffers) && (p.maxMembers == null || USAGE.members <= p.maxMembers);

export default function PlanoPage() {
  const [asked, setAsked] = useState<string | null>(null);
  const cur = PLANS.find((p) => p.code === CURRENT)!;
  const group = GROUPS.find((g) => g.code === GROUP)!;
  const suggested = PLANS.find((p) => p.code === group.planCode)!;

  return (
    <>
      <PageHeader title="Plano" subtitle="O que o seu plano inclui, o quanto você já usou e como mudar." />
      <Card>
        <p className="text-sm text-muted">Seu plano</p>
        <h2 className="text-2xl font-semibold">{cur.name}</h2>
        <p className="text-sm text-muted">Taxa de {cur.feeBps / 100}% sobre cada venda por indicação, cobrada por cima da comissão. Grupo: {group.name}.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Meter label="Indicadores ativos" used={USAGE.referrers} max={cur.maxReferrers} />
          <Meter label="Produtos" used={USAGE.offers} max={cur.maxOffers} />
          <Meter label="Usuários" used={USAGE.members} max={cur.maxMembers} />
        </div>
        {suggested.code !== cur.code && <p className="mt-4 rounded-brand bg-amber-50 p-3 text-sm text-amber-900">Para uma empresa do seu perfil, o Indiki+ costuma indicar o plano {suggested.name}.</p>}
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Compare os planos</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.filter((p) => p.active).map((p) => {
          const isCur = p.code === CURRENT;
          const ok = fits(p);
          return (
            <Card key={p.code} className={isCur ? "border-brand ring-2 ring-brand-line" : ""}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
              <p className="mt-3 text-sm font-medium">{p.priceCents != null ? `R$ ${(p.priceCents / 100).toFixed(2).replace(".", ",")}/mês` : "Preço a definir"}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>Taxa de {p.feeBps / 100}% por venda</li>
                <li>{p.maxReferrers ?? "Indicadores ilimitados"}{p.maxReferrers ? " indicadores" : ""}</li>
                <li>{p.maxOffers ?? "Produtos ilimitados"}{p.maxOffers ? " produtos" : ""}</li>
                <li>{p.maxMembers ?? "Usuários ilimitados"}{p.maxMembers ? ` ${p.maxMembers === 1 ? "usuário" : "usuários"}` : ""}</li>
                <li>Relatórios: {REPORT_LABEL[p.report]}</li>
                <li>Suporte: {SUPPORT_LABEL[p.support]}</li>
                <li className="flex items-center gap-1">{p.crm ? <Check size={14} className="text-brand" aria-hidden /> : <Minus size={14} className="text-muted" aria-hidden />} Integração com o CRM</li>
                <li className="flex items-center gap-1">{p.highlight ? <Check size={14} className="text-brand" aria-hidden /> : <Minus size={14} className="text-muted" aria-hidden />} Destaque na vitrine</li>
              </ul>
              <div className="mt-4">
                {isCur ? <p className="rounded-brand bg-brand-soft px-3 py-2 text-center text-sm font-medium text-brand">Seu plano</p>
                  : !ok ? <p className="text-xs text-muted">Você tem mais indicadores, produtos ou usuários do que este plano permite.</p>
                  : <button onClick={() => setAsked(p.name)} className="w-full rounded-brand border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft">Quero este plano</button>}
              </div>
            </Card>
          );
        })}
      </div>
      {asked && <p role="status" className="mt-4 rounded-brand bg-emerald-50 p-3 text-sm text-emerald-900">Pedido de mudança para o plano {asked} enviado ao Indiki+ (exemplo). No sistema real, o administrador confirma e a mudança passa a valer.</p>}
    </>
  );
}
