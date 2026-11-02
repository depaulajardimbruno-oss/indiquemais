import { Card, PageHeader } from "@/components/ui";
import { CompanyBadge } from "@/components/CompanyBadge";
import { StageProgress } from "@/components/StageProgress";
import { referrals } from "@/lib/indicador";
import { shortDate } from "@/lib/mock";

export const metadata = { title: "Minhas indicações" };

export default function IndicacoesPage() {
  return (
    <>
      <PageHeader
        title="Minhas indicações"
        subtitle="Acompanhe cada amigo indicado, da primeira conversa até a comissão."
      />
      <p className="mb-4 rounded-brand bg-brand-soft p-3 text-xs text-muted">
        Para proteger a privacidade de quem você indicou, mostramos só o primeiro nome e a etapa.
        Endereço e valor do orçamento ficam entre ele e a empresa.
      </p>
      <ul className="space-y-3">
        {referrals.map((r) => (
          <li key={r.id}>
            <Card className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1"><CompanyBadge companyId={r.companyId} /></div>
                  <p className="font-medium">{r.friend}</p>
                  <p className="text-xs text-muted">
                    {r.offer} · {shortDate(r.date)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  {r.via === "link" ? "Pelo seu link" : "Pelo seu nome"}
                </span>
              </div>
              <StageProgress stage={r.stage} />
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
