"use client";

import { useState } from "react";
import { Card, PageHeader, Pill } from "@/components/ui";
import { ScoreEditor } from "@/components/admin/ScoreEditor";
import { SealBadge } from "@/components/SealBadge";
import { CERTS, SEAL_CRITERIA, SEAL_LEVELS, levelName, type Cert } from "@/lib/plataforma";

export default function SelosAdmin() {
  const [certs, setCerts] = useState<Cert[]>(CERTS);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function revoke(code: string) {
    if (reason.trim().length < 5) return setErr("Informe o motivo da revogação (mínimo 5 letras).");
    setCerts((c) => c.map((x) => (x.code === code ? { ...x, status: "revogado", reason: reason.trim() } : x)));
    setRevoking(null); setReason(""); setErr(null);
  }

  return (
    <>
      <PageHeader title="Selos e certificados" subtitle="O selo é conquistado, nunca comprado. A empresa sobe de nível pelos pontos; cada selo vira um certificado que qualquer pessoa pode conferir." />
      <ScoreEditor
        levelsTitle="Níveis do selo"
        levels={SEAL_LEVELS}
        criteria={SEAL_CRITERIA}
        salesKey="closed_sales"
        defaultMetrics={{ closed_sales: 12, confirmed_commissions: 10, disputes: 0, months_active: 2, fee_on_time: 3 }}
        simTitle="Simulador: que selo uma empresa teria?"
        renderResult={(level, points, next) => (
          <div className="flex flex-col items-center gap-2">
            {level ? <SealBadge level={level.code} label={level.name} size={96} id="sim" /> : <p className="py-6 text-sm text-muted">Sem selo</p>}
            <p className="text-2xl font-semibold tabular-nums">{points} pts</p>
            {next && <p className="text-xs text-muted">Faltam {next.missing} pts (e as vendas mínimas) para {next.name}</p>}
          </div>
        )}
      />

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="p-4 text-left text-lg font-semibold">Certificados emitidos</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr><th className="px-4 py-2 font-medium">Código</th><th className="px-4 py-2 font-medium">Empresa</th><th className="px-4 py-2 font-medium">Nível</th><th className="px-4 py-2 font-medium">Validade</th><th className="px-4 py-2 font-medium">Situação</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {certs.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3">{c.company}</td>
                <td className="px-4 py-3">{levelName(c.level)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{c.issuedAt} a {c.validUntil}</td>
                <td className="px-4 py-3"><Pill status={c.status} />{c.reason && <p className="mt-1 text-xs text-muted">{c.reason}</p>}</td>
                <td className="px-4 py-3 text-right">
                  {c.status === "valido" && (revoking === c.code ? (
                    <div className="flex flex-col items-end gap-2">
                      <input aria-label="Motivo da revogação" className="w-56 rounded-brand border border-line px-2 py-1.5 text-sm" placeholder="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => revoke(c.code)} className="rounded-brand bg-rose-700 px-3 py-1.5 text-xs font-medium text-white">Revogar</button>
                        <button onClick={() => { setRevoking(null); setErr(null); }} className="rounded-brand border border-line px-3 py-1.5 text-xs">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setRevoking(c.code)} className="rounded-brand border border-line px-3 py-1.5 text-xs font-medium hover:bg-brand-soft">Revogar</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-sm text-muted">Certificado revogado ou vencido deixa de aparecer como válido na página pública de verificação, e o selo no site da empresa muda de acordo.</p>
    </>
  );
}
