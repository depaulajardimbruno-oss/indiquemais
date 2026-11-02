import { STAGES, type Stage } from "@/lib/indicador";

/** Linha de etapas de uma indicação: o indicador vê em que ponto está, sem ver valores nem endereço. */
export function StageProgress({ stage }: { stage: Stage }) {
  if (stage === "perdido") {
    return (
      <p className="rounded-brand bg-slate-100 px-3 py-2 text-sm text-slate-700">
        Seu amigo não fechou desta vez. Sem problema: nenhuma comissão aqui.
      </p>
    );
  }
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <div>
      <ol className="flex items-center gap-1" aria-label="Etapas da indicação">
        {STAGES.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-1">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                i <= current ? "bg-brand text-brand-fg" : "bg-line text-muted"
              }`}
              aria-current={i === current ? "step" : undefined}
            >
              {i + 1}
            </span>
            {i < STAGES.length - 1 && (
              <span className={`h-0.5 flex-1 ${i < current ? "bg-brand" : "bg-line"}`} aria-hidden />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm">
        <strong>{STAGES[current].label}.</strong>{" "}
        <span className="text-muted">{STAGES[current].hint}</span>
      </p>
    </div>
  );
}
