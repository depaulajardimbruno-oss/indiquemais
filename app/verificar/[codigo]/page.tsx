import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { SealBadge } from "@/components/SealBadge";
import { Logo } from "@/components/Logo";
import { getBrand } from "@/lib/brand";
import { certByCode, levelName } from "@/lib/plataforma";

export const metadata = { title: "Verificar selo" };

async function Result({ params }: { params: PageProps<"/verificar/[codigo]">["params"] }) {
  const { codigo } = await params;
  const cert = certByCode(decodeURIComponent(codigo));
  const status = cert?.status ?? "inexistente";
  const ok = status === "valido";
  const Icon = ok ? CheckCircle2 : status === "expirado" ? Clock : XCircle;
  const title = ok ? "Selo verdadeiro" : status === "revogado" ? "Selo revogado" : status === "expirado" ? "Selo vencido" : status === "desatualizado" ? "Selo desatualizado" : "Código não encontrado";
  const text = ok
    ? `${cert!.company} é uma empresa verificada pelo Indiki+, com o selo ${levelName(cert!.level)}.`
    : status === "inexistente"
      ? "Não existe selo com esse código. Confira se o código foi digitado corretamente. Se a imagem está no site de uma empresa, desconfie."
      : "Este certificado não vale mais. O selo mostrado no site da empresa pode estar desatualizado.";
  return (
    <div className="text-center">
      <Icon size={40} aria-hidden className={`mx-auto ${ok ? "text-emerald-600" : "text-rose-600"}`} />
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">{text}</p>
      {cert && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <SealBadge level={cert.level} label={levelName(cert.level)} size={130} id="ver" />
          <dl className="grid w-full max-w-sm grid-cols-2 gap-2 rounded-brand border border-line bg-white p-4 text-left text-sm">
            <dt className="text-muted">Empresa</dt><dd className="font-medium">{cert.company}</dd>
            <dt className="text-muted">Nível</dt><dd className="font-medium">{levelName(cert.level)}</dd>
            <dt className="text-muted">Emitido em</dt><dd className="font-medium">{cert.issuedAt}</dd>
            <dt className="text-muted">Válido até</dt><dd className="font-medium">{cert.validUntil}</dd>
            <dt className="text-muted">Código</dt><dd className="font-mono text-xs">{cert.code}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

export default async function VerificarPage({ params }: PageProps<"/verificar/[codigo]">) {
  const brand = await getBrand();
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-2xl items-center px-4 py-3"><Link href="/"><Logo name={brand.name} logoUrl={brand.logoUrl} height={26} /></Link></div></header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Suspense fallback={<p className="text-center text-muted">Conferindo o selo…</p>}><Result params={params} /></Suspense>
        <section className="mt-10 rounded-brand border border-line bg-white p-5 text-sm">
          <h2 className="font-semibold">O que o selo Indiki+ significa</h2>
          <p className="mt-1 text-muted">Empresas com o selo participam do programa de indicação do Indiki+. O nível (Bronze, Prata, Ouro, Platina e Diamante) é conquistado por vendas fechadas, avaliações positivas dos indicadores e pagamentos em dia. O selo não pode ser comprado. Quem indica uma empresa verificada recebe a comissão combinada, paga pelo Indiki+.</p>
        </section>
      </main>
    </div>
  );
}
