"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { brl } from "@/lib/comissao";

// Cálculo do CPF (mesma regra do banco)
function validCpf(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
const mask = (v: string) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const PAYMENTS = [
  { month: "10/2026", company: "Soulglass", gross: 30000, irrf: 0, inss: 0 },
];

export default function InformePage() {
  const [cpf, setCpf] = useState("");
  const [name, setName] = useState("Marina Souza");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gross = PAYMENTS.reduce((s, p) => s + p.gross, 0);
  const irrf = PAYMENTS.reduce((s, p) => s + p.irrf, 0);
  const inss = PAYMENTS.reduce((s, p) => s + p.inss, 0);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validCpf(cpf)) { setSaved(false); return setErr("CPF inválido. Confira os números."); }
    setErr(null); setSaved(true);
  }

  return (
    <>
      <PageHeader title="Informe de rendimentos" subtitle="O Indiki+ paga as suas comissões e, por isso, precisa do seu CPF para emitir o informe que você usa no imposto de renda." />
      <Card>
        <h2 className="font-semibold">Seus dados para o informe</h2>
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Nome completo
            <input className="mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="text-sm font-medium">CPF
            <input className="mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm tabular-nums" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => { setCpf(mask(e.target.value)); setSaved(false); }} required aria-invalid={!!err} /></label>
          <div className="sm:col-span-2">
            <button className="rounded-brand bg-brand px-5 py-2 text-sm font-medium text-brand-fg">Salvar</button>
            {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
            {saved && <p role="status" className="mt-2 text-sm text-emerald-800">CPF salvo. Só você e o Indiki+ veem esse dado. Se ele mudar, o informe é emitido de novo numa versão nova.</p>}
          </div>
        </form>
      </Card>

      <Card className="mt-4 p-0">
        <h2 className="p-4 pb-2 font-semibold">Pagamentos recebidos em 2026</h2>
        <ul className="divide-y divide-line text-sm">
          {PAYMENTS.map((p) => (
            <li key={p.month} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>{p.month} · {p.company}</span>
              <span className="tabular-nums">bruto {brl(p.gross)} · IRRF {brl(p.irrf)} · INSS {brl(p.inss)} · <strong>líquido {brl(p.gross - p.irrf - p.inss)}</strong></span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
          <p className="text-sm">Total no ano: bruto {brl(gross)} · retido {brl(irrf + inss)}</p>
          <Link href="/indicador/informe/2026" className="rounded-brand border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft">Ver informe de 2026</Link>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">O informe fica disponível até o fim de fevereiro do ano seguinte. Em caso de dúvida sobre imposto, fale com o seu contador.</p>
    </>
  );
}
