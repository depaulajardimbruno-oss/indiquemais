"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Card, PageHeader, Pill } from "@/components/ui";
import { SealBadge } from "@/components/SealBadge";
import { useOrigin } from "@/components/useOrigin";
import { SEAL_CRITERIA, SEAL_LEVELS, calcPoints, certByCode, levelName } from "@/lib/plataforma";

// Soulglass (empresa piloto)
const METRICS = { closed_sales: 12, confirmed_commissions: 9, disputes: 0, months_active: 2, fee_on_time: 3 };
const CODE = "IM-K7QX-2M9A";

export default function SeloPage() {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const cert = certByCode(CODE)!;
  const points = calcPoints(METRICS, SEAL_CRITERIA);
  const levels = SEAL_LEVELS.filter((l) => l.active);
  const current = [...levels].reverse().find((l) => points >= l.minPoints && METRICS.closed_sales >= l.minSales) ?? null;
  const next = levels.find((l) => !current || l.minPoints > current.minPoints) ?? null;
  const missingPts = next ? Math.max(next.minPoints - points, 0) : 0;
  const missingSales = next ? Math.max(next.minSales - METRICS.closed_sales, 0) : 0;

  const embed = `<a href="${origin}/verificar/${CODE}" target="_blank" rel="noopener">\n  <img src="${origin}/selo/${CODE}" alt="Selo Indiki+ ${levelName(cert.level)}" width="120" height="138">\n</a>`;
  async function copy() {
    try { await navigator.clipboard.writeText(embed); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* o código continua visível para copiar à mão */ }
  }

  return (
    <>
      <PageHeader title="Selo Indiki+" subtitle="O selo é conquistado pelo que você faz dentro do Indiki+: vendas, avaliações dos indicadores e pagamentos em dia. Não dá para comprar." />
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-2 px-10">
          {current && <SealBadge level={current.code} label={current.name} size={150} id="main" />}
          <p className="text-3xl font-semibold tabular-nums">{points} pts</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Próximo nível: {next?.name ?? "você já está no topo"}</h2>
          {next && (
            <>
              <p className="mt-1 text-sm text-muted">Faltam {missingPts} pontos{missingSales > 0 ? ` e ${missingSales} vendas fechadas` : ""} para o selo {next.name}.</p>
              <div className="mt-3 h-2 rounded-full bg-slate-200" role="progressbar" aria-label="Progresso para o próximo selo" aria-valuenow={points} aria-valuemin={current?.minPoints ?? 0} aria-valuemax={next.minPoints}>
                <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round(((points - (current?.minPoints ?? 0)) / (next.minPoints - (current?.minPoints ?? 0))) * 100))}%` }} />
              </div>
            </>
          )}
          <h3 className="mt-5 text-sm font-medium">Como você chegou aqui</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {SEAL_CRITERIA.filter((c) => c.active).map((c) => {
              const raw = METRICS[c.code as keyof typeof METRICS] ?? 0;
              const pts = Math.min(raw * c.weight, c.max ?? Infinity);
              return <li key={c.code} className="flex justify-between gap-3 py-2"><span>{c.name} <span className="text-muted">({raw})</span></span><span className="tabular-nums">{pts > 0 ? "+" : ""}{pts} pts</span></li>;
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Seu certificado</h2><p className="text-sm text-muted">Código <span className="font-mono">{cert.code}</span> · válido de {cert.issuedAt} a {cert.validUntil}</p></div>
          <Pill status={cert.status} />
        </div>
        <p className="mt-2 text-sm text-muted">Se o seu nível mudar, o certificado antigo deixa de valer e o Indiki+ emite um novo. O selo no seu site acompanha sozinho.</p>
        <p className="mt-2 text-sm"><Link href={`/verificar/${CODE}`} className="font-medium text-brand underline">Ver como o cliente confere o seu selo</Link></p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Coloque o selo no seu site</h2>
        <p className="text-sm text-muted">Quem clicar no selo vê a página de verificação do Indiki+, que confirma que o selo é verdadeiro e o que ele significa.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <pre className="overflow-x-auto rounded-brand bg-slate-900 p-3 text-xs leading-relaxed text-slate-100" aria-label="Código do selo para colar no site">{embed}</pre>
            <button onClick={copy} className="mt-3 inline-flex items-center gap-2 rounded-brand border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft">
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}{copied ? "Copiado" : "Copiar código"}
            </button>
          </div>
          <div className="rounded-brand border border-line bg-slate-50 p-4" aria-label="Pré-visualização no rodapé de um site">
            <p className="text-xs text-muted">Assim fica no rodapé do seu site:</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded bg-white p-4 shadow-sm">
              <div><p className="font-semibold">Soulglass</p><p className="text-xs text-muted">Indique um amigo e ganhe comissão.</p></div>
              {current && <SealBadge level={current.code} label={current.name} size={72} id="prev" />}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
