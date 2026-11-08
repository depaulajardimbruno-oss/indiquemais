import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  ChevronDown,
  Eye,
  GraduationCap,
  Hammer,
  Building2,
  UserRound,
  Ruler,
  TrendingUp,
  HeartPulse,
  Link2,
  LockKeyhole,
  PiggyBank,
  Plug,
  Receipt,
  Sofa,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { getBrand } from "@/lib/brand";
import { StageProgress } from "@/components/StageProgress";
import { Logo } from "@/components/Logo";
import lion from "@/public/brand/leao.png";

const STEPS = [
  {
    icon: UserRound,
    title: "Cadastre-se",
    text: "Receba um link exclusivo para indicar. É grátis.",
  },
  {
    icon: Link2,
    title: "Compartilhe",
    text: "Mande pelo WhatsApp para amigos, clientes e parceiros.",
  },
  {
    icon: Eye,
    title: "Acompanhe",
    text: "Veja quem pediu orçamento e em que etapa cada indicação está.",
  },
  {
    icon: Wallet,
    title: "Ganhe",
    text: "Venda concluída e paga? A comissão é liberada para você.",
  },
];

const WHO = [
  {
    icon: Ruler,
    title: "Profissionais",
    text: "Arquitetos, designers e outros profissionais ganham comissão ao recomendar produtos e serviços em que confiam.",
  },
  {
    icon: HeartPulse,
    title: "Clientes",
    text: "Quem já comprou e gostou indica o que usa e é recompensado com comissão ou benefícios.",
  },
  {
    icon: Building2,
    title: "Empresas",
    text: "Criam uma rede de promotores engajados e pagam só quando a venda acontece.",
  },
];

const FOR_YOU = [
  { icon: PiggyBank, title: "Indicar não custa nada", text: "Você não paga para participar." },
  { icon: Eye, title: "Você vê cada etapa", text: "Sabe se pediram orçamento, se fechou e quando sai o pagamento." },
  { icon: Receipt, title: "Receba por PIX", text: "Informe sua chave uma vez. As recompensas são pagas todo último dia do mês." },
  { icon: LockKeyhole, title: "Privacidade de quem você indica", text: "Você vê só o primeiro nome. Endereço e valores ficam entre o amigo e a empresa." },
];

const FOR_COMPANIES = [
  { icon: TrendingUp, title: "Mais vendas, de forma orgânica", text: "Cada profissional ou cliente vira um canal de venda, e indicação converte mais do que anúncio." },
  { icon: Plug, title: "Menos trabalho manual", text: "O sistema rastreia a indicação e organiza o pagamento da recompensa. Depois conectamos ao sistema que você já usa." },
  { icon: Users, title: "Clientes que viram embaixadores", text: "Reconhecer quem indica fideliza e faz a rede crescer sozinha." },
  { icon: BadgeCheck, title: "Transparência total", text: "Painel com quem indicou, o que foi vendido e quanto foi gerado." },
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
    a: "Nada. Criar a conta e indicar é gratuito.",
  },
  {
    q: "Preciso ser cliente de alguma empresa?",
    a: "Não. Clientes indicam o que usam e gostam, e profissionais como arquitetos e designers indicam produtos e serviços em que confiam. Basta criar a conta, que é gratuita.",
  },
  {
    q: "Posso indicar mais de uma empresa?",
    a: "Pode. Se você é cliente de duas empresas parceiras, tem um link para cada uma e um só painel. Cada indicação e cada comissão mostra de qual empresa vem, e você recebe tudo junto, no mesmo pagamento.",
  },
  {
    q: "E se meu amigo não usar o meu link?",
    a: "Sem problema. Ao pedir o orçamento, ele diz que foi indicado por você, com seu nome e telefone. Você recebe um aviso para confirmar. Sem a sua confirmação, a indicação não vale.",
  },
  {
    q: "Quando recebo a comissão?",
    a: "Depois que a venda do seu amigo for concluída e paga. As recompensas são pagas todo último dia do mês, e você acompanha tudo no painel.",
  },
  {
    q: "Como recebo o dinheiro?",
    a: "Por PIX, na chave que você cadastrar. Quando cair na conta, você confirma no painel. Se não caiu, é só avisar ali mesmo.",
  },
  {
    q: "Quanto a empresa paga ao Indiki+?",
    a: "Apenas 1% sobre as vendas já realizadas por indicação. Sem venda, sem custo.",
  },
  {
    q: "Meus dados e os do meu amigo ficam seguros?",
    a: "Guardamos o mínimo necessário e pedimos o consentimento de quem pede orçamento. Quem indica vê só o primeiro nome do amigo.",
  },
];

const btnPrimary =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 py-3 text-base font-bold text-ink shadow-sm hover:brightness-95";
const btnSecondary =
  "inline-flex min-h-12 items-center justify-center rounded-full border-2 border-brand px-7 py-3 text-base font-semibold text-brand hover:bg-brand-soft";

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
          <Link href="/" aria-label={`${brand.name}, página inicial`}>
            <Logo name={brand.name} logoUrl={brand.logoUrl} height={34} />
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
        <section className="relative overflow-hidden bg-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 opacity-60 [background-image:radial-gradient(var(--accent)_2px,transparent_2.5px)] [background-size:16px_16px] [mask-image:radial-gradient(circle_at_70%_30%,black,transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
            <div className="pb-12 lg:pb-20">
              <p className="text-lg font-bold text-brand">Indique | Acompanhe | Ganhe</p>
              <h1 className="mt-3 font-display text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold leading-[1.05] tracking-tight text-brand">
                Transforme suas indicações em conquistas reais.
              </h1>
              <p className="mt-5 max-w-[34rem] text-xl leading-relaxed">
                Gostou do serviço de uma empresa e indicou para um vizinho? Se ele fechar, você
                ganha uma comissão. Simples, automático e transparente.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/entrar" className={btnPrimary}>
                  Entrar
                </Link>
                <a href="#empresas" className={btnSecondary}>
                  Tenho uma empresa
                </a>
              </div>
              <p className="mt-4 text-base text-muted">
                O cadastro é feito pelo link que a empresa parceira envia para você.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-sm self-end lg:max-w-md">
              <div aria-hidden className="absolute inset-x-[-8%] bottom-0 top-[18%] rounded-t-full bg-gradient-to-b from-accent to-accent/10" />
              <Image src={lion} alt="Leão, mascote do Indiki+, de braços cruzados" priority className="relative h-auto w-full" sizes="(min-width:1024px) 440px, 90vw" />
              <div className="absolute -left-2 bottom-8 flex max-w-[15rem] items-center gap-3 rounded-2xl border-2 border-accent bg-white px-4 py-3 shadow-md sm:-left-10">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/25">
                  <Wallet size={22} aria-hidden />
                </span>
                <p className="text-sm leading-snug">
                  <strong className="block text-base">Comissão liberada</strong>
                  <span className="text-muted">Exemplo ilustrativo</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-brand-soft">
          <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 py-12 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-brand md:text-3xl">
                Você já pensou no poder das indicações?
              </h2>
              <p className="mt-3 max-w-[40rem] text-lg leading-relaxed">
                Segundo o material do Indiki+, 90% das pessoas confiam mais em recomendações de
                amigos ou profissionais do que em propaganda comum. E se cada recomendação sua fosse
                recompensada?
              </p>
            </div>
            <p className="font-display text-xl font-bold text-brand md:text-right">
              Chegou a hora de valorizar<br />o que você indica.
            </p>
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

        <section className="bg-brand text-brand-fg">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Quem pode usar o Indiki+
            </h2>
            <p className="mt-3 max-w-[40rem] text-lg opacity-90">No Indiki+ todo mundo sai ganhando.</p>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {WHO.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-brand bg-white/10 p-6 ring-1 ring-white/20">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-ink">
                    <Icon size={26} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-base leading-relaxed opacity-90">{text}</p>
                </li>
              ))}
            </ul>
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
                <p className="mt-3 text-sm text-muted">Você pode acompanhar indicações de várias empresas no mesmo painel, cada uma com seu link e sua comissão.</p>
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
              Quem já comprou de você é a melhor propaganda. Com o Indiki+, você premia essa
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
            <div className="mt-8 flex flex-wrap items-center gap-5 rounded-brand bg-brand p-6 text-brand-fg">
              <p className="font-display text-6xl font-extrabold leading-none text-accent">1%</p>
              <p className="max-w-md text-lg leading-snug">
                é tudo o que a empresa paga ao Indiki+, só sobre vendas já realizadas por indicação.
                Sem venda, sem custo.
              </p>
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
              Pronto para transformar indicações em oportunidades? Cadastre-se e comece a ganhar.
            </h2>
            <Link
              href="/entrar"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 py-3 text-base font-bold text-ink hover:brightness-95"
            >
              Entrar para indicar
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <p>
            <strong className="text-ink">{brand.name}</strong>. Plataforma em fase de testes. www.indikimais.com.br
          </p>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/entrar" className="hover:text-brand">Entrar</Link>
            <Link href="/termos" className="hover:text-brand">Termos e dados</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
