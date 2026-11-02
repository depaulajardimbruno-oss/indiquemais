"use client";

export function PrintButton({ label = "Imprimir ou salvar em PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-fg print:hidden">
      {label}
    </button>
  );
}
