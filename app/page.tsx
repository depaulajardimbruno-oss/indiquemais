import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  ChevronDown,
  Eye,
  GraduationCap,
  Hammer,
  Handshake,
  HeartPulse,
  Link2,
  LockKeyhole,
  MessageCircle,
  PiggyBank,
  Plug,
  Receipt,
  Scale,
  Sofa,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { getBrand } from "@/lib/brand";
import { StageProgress } from "@/components/StageProgress";

const STEPS = [
  {
    icon: Handshake,
    title: "Você fecha com uma empresa parceira",
    text: "Gostou do serviço? A empresa convida você para indicar quem você conhece.",
  },
  {
    icon: Link2,
    title: "Você recebe o seu link",
    text: "Ele é só seu. Mande pelo WhatsApp para amigos, vizinhos e família.",
  },
  {
    icon: MessageCircle,
    title: "Seu amigo pede um orçamento",
    text: "Pelo seu link ou falando o seu nome. Você acompanha cada etapa pelo celular.",
  },
  {
    icon: Wallet,
    title: "Fechou? Você recebe",
    text: "A empresa paga direto no seu PIX e você confirma que recebeu.",
  },
];

const FOR_YOU = [
  { icon: PiggyBank, title: "Indicar não custa nada", text: "Você não paga para participar." },
  { icon: Eye, title: "Você vê cada etapa", text: "Sabe se pediram orçamento, se fechou e quando sai o pagamento." },
  { icon: Receipt, title: "Receba direto no PIX", text: "Sem intermediário segurando o seu dinheiro." },
  { icon: LockKeyhole, title: "Privacidade de quem você indica", text: "Você vê só o primeiro nome. Endereço e valores ficam entre o amigo e a empresa." },
];

const FOR_COMPANIES = [
  { icon: Scale, title: "Você só paga quando vende", text: "A comissão nasce depois que o serviço foi entregue e pago." },
  { icon: BadgeCheck, title: "Você define as regras", text: "Valor fixo ou percentual, por produto, com o prazo de segurança que preferir." },
  { icon: Users, title: "Sabe quem trouxe cada cliente", text: "Toda indicação fica registrada, com etapa e histórico." },
  { icon: Plug, title: "Começa simples, depois conecta", text: "No início você registra as vendas no painel. Depois ligamos ao sistema que você já usa." },
];

const NICHES = [
  { icon: Hammer, label: "Reformas e construção" },
  { icon: Sofa, label: "Casa e decoração" },
  { icon: HeartPulse, label: "Saúde e bem-estar" },
  { icon: Sparkles, label: "Beleza e estética" },
  { icon: GraduationCap, label: "Cursos e educação" },
  { icon: Briefcase, label: "Serviços profissionais" },
];

const FAQ = [
  {
    q: "Quanto custa para indicar?",
    a: "Nada. Quem indica não paga nada para participar e para receber.",
  },
  {
    q: "Preciso ser cliente de alguma empresa?",
    a: "Nesta fase de testes, sim: indicam os clientes que a empresa parceira convidou. Depois, a ideia é abrir para mais pessoas.",
  },
  {
    q: "E se meu amigo não usar o meu link?",
    a: "Sem problema. Ao pedir o orçamento, ele diz que foi indicado por você, com seu nome e telefone. Você recebe um aviso para confirmar. Sem a sua confirmação, a indicação não vale.",
  },
  {
    q: "Quando recebo a comissão?",
    a: "Depois que o serviço do seu amigo for feito e pago, e o prazo de segurança da empresa passar. Você acompanha tudo no painel.",
  },
  {
    q: "Como recebo o dinheiro?",
    a: "A empresa paga direto na sua chave PIX. Quando cair na conta, você confirma no painel. Se não caiu, é só avisar ali mesmo.",
  },
  {
    q: "Meus dados e os do meu amigo ficam seguros?",
    a: "Guardamos o mínimo necessário e pedimos o consentimento de quem pede orçamento. Quem indica vê só o primeiro nome do amigo.",
  },
];

const btnPrimary =
  "inline-flex min-h-12 items-center justify-center rounded-brand bg-brand px-6 py-3 text-base font-semibold text-brand-fg hover:opacity-90";
const btnSecondary =
  "inline-flex min-h-12 items-center justify-center rounded-brand border-2 border-brand px-6 py-3 text-base font-semibold text-brand hover:bg-brand-soft";

export default async function Home() {
  const brand = await getBrand();

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-brand focus:bg-white focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-brand bg-brand text-lg font-bold text-brand-fg">
              {brand.name.charAt(0)}
            </span>
            <span className="font-display text-xl font-bold">{brand.name}</span>
          </Link>
          <nav aria-label="Seções da página" className="hidden items-center gap-6 text-base font-medium md:flex">
            <a href="#como-funciona" className="hover:text-brand">Como funciona</a>
            <a href="#para-voce" className="hover:text-brand">Para quem indica</a>
            <a href="#empresas" className="hover:text-brand">Para empresas</a>
            <a href="#perguntas" className="hover:text-brand">Perguntas</a>
          </nav>
          <Link href="/entrar" className={`${btnSecondary} min-h-11 px-5 py-2`}>
            Entrar
          </Link>
        </div>
      </header>

      <main id="conteudo">
        {/* Abertura: a conversa entre vizinhos é o coração do produto */}
        <section className="bg-brand-soft">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-2 lg:py-20">
            <div>
              <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.05] tracking-tight">
                Quem recomenda bem, ganha por isso.
              </h1>
              <p className="mt-5 max-w-[34rem] text-xl leading-relaxed">
                Gostou do serviço de uma empresa e indicou para um vizinho? Se ele fechar, você
                recebe uma comissão. Simples assim.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/entrar" className={btnPrimary}>
                  Entrar para indicar
                </Link>
                <a href="#empresas" className={btnSecondary}>
                  Tenho uma empresa
                </a>
              </div>
              <p className="mt-4 text-base text-muted">
                Nesta fase de testes, indicam os clientes convidados por empresas parceiras.
              </p>
            </div>

            <figure className="mx-auto w-full max-w-md">
              <div className="rounded-[1.75rem] border border-line bg-white p-4 shadow-sm sm:p-5">
                <div className="space-y-3 text-base">
                  <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-3 text-brand-fg">
                    Fechei a sacada da minha casa e adorei o serviço. Peça seu orçamento pelo meu link.
                  </p>
                  <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 ring-1 ring-line">
                    Pedi pelo seu link e já fechei! Obrigado pela dica.
                  </p>
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-accent bg-white px-4 py-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/20">
                      <Wallet size={22} aria-hidden />
                    </span>
                    <p className="leading-snug">
                      <strong className="block">Comissão liberada</strong>
                      <span className="text-muted">R$ 300,00 direto no seu PIX</span>
                    </p>
                  </div>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-sm text-muted">
                Exemplo ilustrativo de como funciona
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Como funciona, em quatro passos
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="rounded-brand border border-line p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-lg font-bold text-brand-fg">
                      {i + 1}
                    </span>
                    <Icon size={28} className="text-brand" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-xl font-bold leading-snug">{title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="para-voce" className="scroll-mt-4 bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Para quem indica: tudo à vista no celular
              </h2>
              <p className="mt-4 max-w-[34rem] text-lg leading-relaxed">
                Você não precisa perguntar para ninguém como anda a indicação. Cada passo aparece
                no seu painel.
              </p>
              <ul className="mt-8 space-y-5">
                {FOR_YOU.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-brand bg-brand-soft text-brand">
                      <Icon size={24} aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold">{title}</h3>
                      <p className="text-base leading-relaxed text-muted">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <figure className="self-center">
              <div className="rounded-brand border border-line bg-white p-5 shadow-sm">
                <p className="font-bold">Carlos M.</p>
                <p className="mb-4 text-sm text-muted">Envidraçamento de sacada</p>
                <StageProgress stage="fechou" />
              </div>
              <figcaption className="mt-3 text-center text-sm text-muted">
                Exemplo de como você acompanha uma indicação
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="empresas" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Para empresas: clientes satisfeitos viram sua equipe de vendas
            </h2>
            <p className="mt-4 max-w-[40rem] text-lg leading-relaxed">
              Quem já comprou de você é a melhor propaganda. Com o Indique Mais, você premia essa
              recomendação e acompanha tudo, sem planilha.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {FOR_COMPANIES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4 rounded-brand border border-line p-6">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-brand bg-brand text-brand-fg">
                    <Icon size={24} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-base leading-relaxed text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/empresa" className={btnPrimary}>
                Ver o painel da empresa
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-brand-soft">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Serve para qualquer negócio que vive de recomendação
            </h2>
            <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
              {NICHES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-brand bg-white p-4 ring-1 ring-line md:p-5"
                >
                  <Icon size={28} className="shrink-0 text-brand" aria-hidden />
                  <span className="text-base font-semibold leading-snug md:text-lg">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Perguntas que todo mundo faz
            </h2>
            <div className="mt-8 divide-y divide-line border-y border-line">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown
                      size={22}
                      className="shrink-0 text-brand transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="pb-4 text-base leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand text-brand-fg">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-14 md:flex-row md:items-center md:justify-between">
            <h2 className="font-display text-3xl font-bold tracking-tight md:max-w-xl md:text-4xl">
              Já é cliente de uma empresa parceira? Comece a indicar hoje.
            </h2>
            <Link
              href="/entrar"
              className="inline-flex min-h-12 items-center justify-center rounded-brand bg-white px-6 py-3 text-base font-semibold text-ink hover:opacity-90"
            >
              Entrar para indicar
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <p>
            <strong className="text-ink">{brand.name}</strong>. Plataforma em fase de testes.
          </p>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/entrar" className="hover:text-brand">Entrar</Link>
            <Link href="/orcamento" className="hover:text-brand">Fui indicado por alguém</Link>
            <Link href="/prototipo" className="hover:text-brand">Telas do protótipo</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
