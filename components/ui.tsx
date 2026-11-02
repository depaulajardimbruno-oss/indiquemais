import type { ReactNode } from "react";
import type { CommissionStatus } from "@/lib/mock";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-brand border border-line bg-white p-5 ${className}`}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "brand" | "warn";
}) {
  const bar =
    tone === "brand" ? "bg-brand" : tone === "warn" ? "bg-accent" : "bg-line";
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

const STATUS: Record<CommissionStatus, { label: string; cls: string }> = {
  pendente: { label: "Em carência", cls: "bg-slate-100 text-slate-700" },
  liberada: { label: "Liberada p/ pagar", cls: "bg-amber-100 text-amber-800" },
  paga: { label: "Paga", cls: "bg-emerald-100 text-emerald-800" },
  contestada: { label: "Contestada", cls: "bg-rose-100 text-rose-800" },
};

export function StatusBadge({ status }: { status: CommissionStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: "api" | "manual" }) {
  return (
    <span className="inline-block rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      {source === "api" ? "Automática (API)" : "Lançamento manual"}
    </span>
  );
}

export function PrototypeBanner() {
  return (
    <div className="bg-accent/15 px-4 py-2 text-center text-xs text-ink">
      Protótipo para validação: valores, nomes e vendas são fictícios e nada é salvo.
    </div>
  );
}

/** Aviso de que a tela é demonstração e nada é gravado. */
export function SaveNote({ saved }: { saved: boolean }) {
  return (
    <p role="status" className={`text-xs ${saved ? "text-emerald-700" : "text-muted"}`}>
      {saved ? "Alterações aplicadas na tela. No sistema real elas são gravadas no banco." : "Protótipo: as mudanças valem só nesta tela."}
    </p>
  );
}

const PILL: Record<string, string> = {
  paga: "bg-emerald-100 text-emerald-800",
  valido: "bg-emerald-100 text-emerald-800",
  aberta: "bg-amber-100 text-amber-800",
  vencida: "bg-rose-100 text-rose-800",
  cancelada: "bg-slate-100 text-slate-600",
  revogado: "bg-rose-100 text-rose-800",
  expirado: "bg-slate-100 text-slate-600",
  desatualizado: "bg-amber-100 text-amber-800",
};
const PILL_LABEL: Record<string, string> = {
  paga: "Paga", valido: "Válido", aberta: "Em aberto", vencida: "Vencida", cancelada: "Cancelada",
  revogado: "Revogado", expirado: "Expirado", desatualizado: "Desatualizado",
};
export function Pill({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[status] ?? "bg-slate-100 text-slate-700"}`}>
      {PILL_LABEL[status] ?? status}
    </span>
  );
}
