import Link from "next/link";
import { Card, StatCard } from "@/components/ui";
import { ShareLink } from "@/components/ShareLink";
import { StageProgress } from "@/components/StageProgress";
import { CompanyBadge } from "@/components/CompanyBadge";
import { companies, me, myCommissions, referrals } from "@/lib/indicador";
import { brl, shortDate } from "@/lib/mock";

export const metadata = { title: "Início" };

export default function IndicadorHome() {
  const closed = referrals.filter((r) => ["fechou", "instalada", "paga"].includes(r.stage)).length;
  const toReceive = myCommissions
    .filter((c) => c.status !== "confirmada" && c.status !== "contestada")
    .reduce((s, c) => s + c.amountCents, 0);
  const received = myCommissions
    .filter((c) => c.status === "confirmada")
    .reduce((s, c) => s + c.amountCents, 0);
  const toConfirm = myCommissions.filter((c) => c.status === "paga").length;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Olá, {me.firstName}</h1>
      <p className="mt-1 text-sm text-muted">
        Você é cliente de {companies.map((c) => c.name).join(" e ")}. Indique amigos e vizinhos e
        ganhe de cada empresa quando eles fecharem.
      </p>

      <div className="mt-5 space-y-3">
        {companies.map((co) => (
          <section key={co.id} className="rounded-brand bg-brand p-5 text-brand-fg">
            <ShareLink code={co.code} company={co.name} />
          </section>
        ))}
      </div>

      <Card className="mt-4">
        <h2 className="font-semibold">Seu amigo não usou o link?</h2>
        <p className="mt-1 text-sm text-muted">
          Sem problema. Ao pedir o orçamento, ele pode dizer que foi indicado por você, com estes dados:
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Seu nome</dt>
            <dd className="font-medium">{me.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Seu telefone</dt>
            <dd className="font-medium">{me.phone}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted">Ele também precisa dizer em qual empresa pediu o orçamento.</p>
        <p className="mt-3 text-xs text-muted">
          Você recebe um aviso para confirmar a indicação. Sem a sua confirmação, ela não vale.
        </p>
      </Card>

      {toConfirm > 0 && (
        <Link
          href="/indicador/comissoes"
          className="mt-4 block rounded-brand border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
        >
          Você tem <strong>{toConfirm} {toConfirm === 1 ? "comissão paga" : "comissões pagas"}</strong> para confirmar. Toque aqui para ver.
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Indicações" value={String(referrals.length)} />
        <StatCard label="Fecharam" value={String(closed)} tone="brand" />
        <StatCard label="A receber" value={brl(toReceive)} tone="warn" />
        <StatCard label="Já recebido" value={brl(received)} />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Indicações recentes</h2>
          <Link href="/indicador/indicacoes" className="text-sm font-medium text-brand">
            Ver todas
          </Link>
        </div>
        <ul className="space-y-3">
          {referrals.slice(0, 3).map((r) => (
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
                </div>
                <StageProgress stage={r.stage} />
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
