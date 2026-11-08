import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getBrand } from "@/lib/brand";
import { TERMS_VERSION } from "@/lib/cadastro";

export const metadata = { title: "Termos de uso e dados" };

export default async function TermosPage() {
  const brand = await getBrand();
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-2xl items-center px-4 py-3"><Link href="/"><Logo name={brand.name} logoUrl={brand.logoUrl} height={26} /></Link></div></header>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-10 text-sm leading-relaxed">
        <h1 className="text-2xl font-semibold tracking-tight">Termos de uso e tratamento de dados</h1>
        <p className="rounded-brand bg-amber-50 p-3 text-amber-900">Versão {TERMS_VERSION}, preliminar. Este texto precisa de revisão jurídica antes do lançamento oficial.</p>
        <section><h2 className="font-semibold">Como funciona</h2><p className="mt-1 text-muted">Você indica amigos a empresas parceiras do Indiki+. Quando uma indicação vira venda, a empresa informa o contrato e você ganha a comissão combinada para aquele produto. O Indiki+ recebe da empresa o valor da comissão e paga você por PIX, uma vez por mês, no último dia do mês, depois do prazo de carência do produto.</p></section>
        <section><h2 className="font-semibold">Regra de comissão</h2><p className="mt-1 text-muted">A comissão vale como estava quando a indicação foi criada. Se a empresa mudar a regra depois, a mudança vale só para indicações novas.</p></section>
        <section><h2 className="font-semibold">Dados que pedimos e por quê</h2><p className="mt-1 text-muted">Nome, CPF, data de nascimento, telefone, cidade e chave PIX servem para pagar você, comprovar que a comissão foi paga e emitir o informe de rendimentos. Podem existir retenções de imposto conforme a lei. O CPF e a chave PIX são usados só para pagamento e obrigações fiscais.</p></section>
        <section><h2 className="font-semibold">Seus direitos</h2><p className="mt-1 text-muted">Você pode pedir acesso, correção ou exclusão dos seus dados, respeitando o que a lei exige guardar (por exemplo, registros de pagamento). Fale com o suporte do Indiki+.</p></section>
        <section><h2 className="font-semibold">Pausa e encerramento</h2><p className="mt-1 text-muted">A empresa pode pausar o seu cadastro nela. Comissões de indicações já feitas continuam valendo.</p></section>
      </main>
    </div>
  );
}
