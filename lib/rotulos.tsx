export const ETAPA: Record<string, { label: string; cls: string; bar: string }> = {
  indicado: { label: "Indicado", cls: "bg-sky-100 text-sky-800", bar: "bg-sky-500" },
  orcamento: { label: "Orçamento", cls: "bg-indigo-100 text-indigo-800", bar: "bg-indigo-500" },
  fechou: { label: "Fechou", cls: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  instalada: { label: "Instalada", cls: "bg-orange-100 text-orange-800", bar: "bg-orange-500" },
  paga: { label: "Paga", cls: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-600" },
  perdido: { label: "Perdida", cls: "bg-slate-100 text-slate-600", bar: "bg-slate-400" },
};
export const ETAPAS_ORDEM = ["indicado", "orcamento", "fechou", "instalada", "paga", "perdido"] as const;

export const COMISSAO: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  liberada: { label: "Liberada para pagar", cls: "bg-sky-100 text-sky-800" },
  paga: { label: "Paga", cls: "bg-emerald-100 text-emerald-800" },
  confirmada: { label: "Paga e confirmada", cls: "bg-emerald-100 text-emerald-800" },
  contestada: { label: "Contestada", cls: "bg-rose-100 text-rose-800" },
  cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-600" },
};

export function Selo({ texto, cls }: { texto: string; cls: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{texto}</span>;
}

export const dataBR = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
