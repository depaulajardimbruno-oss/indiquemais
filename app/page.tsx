import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, BarChart3, Check, ClipboardList, Heart, Link2, Megaphone, Settings2, ShieldCheck,
  TrendingUp, Users, Wallet, X,
} from "lucide-react";
import { getBrand } from "@/lib/brand";
import { getPlanos, pct } from "@/lib/planos";
import { Logo } from "@/components/Logo";
import { StageProgress } from "@/components/StageProgress";
import lion from "@/public/brand/leao.png";

export const metadata = { title: { absolute: "Indiki+ | Indicações: sua maior força de vendas" } };

const INCLUSO = [
  "Programa de indicação completo", "Link e código único para cada indicador", "Rastreamento automático das indicações",
  "Painel em tempo real", "Cálculo e gestão das comissões", "Área exclusiva para os indicadores", "Relatórios de desempenho",
];
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const laranja = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff6600] px-7 py-3 text-base font-bold text-white shadow-[0_10px_30px_-10px_rgba(255,102,0,0.7)] transition hover:bg-[#e65c00] focus-visible:outline-offset-4";
const preto = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-3 text-base font-bold text-white transition hover:bg-black/80";
const selo = "inline-block rounded-full bg-[#ff6600] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white";

export default async function Home() {
  const [brand, planos] = await Promise.all([getBrand(), getPlanos()]);
  const base = Math.max(...planos.map((p) => p.mesCentavos)) / 100;
  const maiorFidelidade = Math.max(...planos.map((p) => p.meses));
  const precos = planos.map((p) => {
    const mes = p.mesCentavos / 100;
    const destaque = planos.length > 1 && p.meses === maiorFidelidade;
    return {
      id: p.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
      nome: p.nome, mes, taxa: pct(p.taxaBps), destaque,
      total: p.meses > 1 ? mes * p.meses : null,
      economia: p.meses > 1 && base > mes ? (base - mes) * p.meses : null,
      desconto: Math.round((1 - mes / base) * 100),
      cta: destaque ? "Criar meu programa de indicação" : "Quero entrar no Indiki+",
    };
  });
  return (
    <div className="bg-white text-[#0a0a0a]">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label={brand.name}><Logo name={brand.name} logoUrl={brand.logoUrl} height={26} /></Link>
          <nav aria-label="Seções" className="hidden rounded-full border border-black/10 px-2 py-1 text-sm font-medium text-black/70 md:block">
            {[["#como-funciona", "Como funciona"], ["#resultados", "Resultados"], ["#recursos", "Recursos"], ["#precos", "Preços"]].map(([h, l]) => (
              <a key={h} href={h} className="inline-block rounded-full px-4 py-1.5 hover:text-black">{l}</a>
            ))}
          </nav>
          <Link href="/entrar" className="rounded-full bg-[#ff6600] px-5 py-2 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(255,102,0,0.8)] hover:bg-[#e65c00]">Login</Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="overflow-hidden bg-gradient-to-b from-[#fff8f3] to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
            <div>
              <span className="inline-block rounded-full bg-black/5 px-4 py-1.5 text-sm font-semibold">Crescimento com quem já confia em você</span>
              <h1 className="mt-5 text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.2rem]">
                Transforme as <span className="text-[#ff6600]">indicações boca a boca</span> na sua <span className="text-[#ff6600]">Maior Força de Vendas.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-black/60">
                Seus clientes indicam amigos, você recebe pedidos de orçamento prontos para fechar e só paga comissão sobre venda fechada. Sem depender de anúncios.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#precos" className={laranja}>Começar agora</a>
                <a href="#como-funciona" className={preto}>Ver como funciona</a>
              </div>
              <p className="mt-5 text-sm text-black/60">
                Quer indicar e ganhar? <Link href="/cadastro" className="font-semibold text-[#ff6600] underline underline-offset-4">Cadastre-se como indicador</Link>
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-md">
              <div aria-hidden className="absolute inset-x-6 bottom-6 top-16 rounded-[2.5rem] bg-[#ff6600]/10" />
              <Image src={lion} alt="Diki, o leão do Indiki+, de braços cruzados com a camiseta da marca" priority className="relative mx-auto h-auto w-[78%] drop-shadow-xl" />
              <div className="absolute bottom-10 left-0 w-56 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5">
                <p className="text-xs text-black/50">Nova indicação</p>
                <p className="font-semibold">Ana pediu orçamento</p>
                <p className="text-xs text-black/50">indicada por Maria · Box de banheiro</p>
              </div>
              <div className="absolute right-0 top-24 rounded-2xl bg-[#0a0a0a] px-4 py-3 text-white shadow-xl">
                <p className="text-xs text-white/60">Comissão liberada</p>
                <p className="text-lg font-bold text-[#ff8a3d]">R$ 300,00</p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="bg-gradient-to-b from-white to-[#fff6ef] py-16">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">É hora de ativar sua maior força de vendas.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-black/60">Com o marketing de indicação, você cresce com benefícios que a publicidade tradicional não alcança.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                [Check, "Baixo custo", "Você só paga comissão quando a indicação vira venda fechada."],
                [Heart, "Fidelização", "Quem chega indicado já confia na sua empresa e costuma ficar mais tempo."],
                [TrendingUp, "Mais vendas", "Cada cliente satisfeito vira um vendedor que traz amigos com a mesma necessidade."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Check;
                return (
                  <div key={t as string} className="rounded-3xl bg-white p-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)]">
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ff6600] to-[#ff9248] text-white"><I size={30} aria-hidden /></span>
                    <h3 className="mt-6 text-lg font-bold">{t as string}</h3>
                    <p className="mt-2 text-black/60">{d as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="scroll-mt-20 bg-[#f8f8f8] py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <span className={selo}>Nosso processo em 3 passos</span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-[#ff6600] sm:text-5xl">A forma inteligente de crescer. Veja como funciona.</h2>
            </div>
            <ol className="mt-14 space-y-16">
              <Passo n={1} titulo="Monte seu programa em minutos" texto="Cadastre os produtos que podem ser indicados e quanto o indicador ganha em cada um: valor fixo, porcentagem do contrato ou os dois, com teto se quiser.">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-black/50">Produtos</p>
                  {[["Envidraçamento de sacada", "R$ 300,00 por venda"], ["Box de banheiro", "2% do contrato (teto R$ 800)"], ["Guarda-corpo", "R$ 100 + 1% do contrato"]].map(([p, r]) => (
                    <div key={p} className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                      <span className="font-semibold">{p}</span><span className="rounded-full bg-[#fff1e8] px-3 py-1 text-sm font-medium text-[#c24d00]">{r}</span>
                    </div>
                  ))}
                </div>
              </Passo>
              <Passo n={2} invertido titulo="Receba pedidos dos amigos dos seus clientes" texto="Cada cliente recebe um link e um código só dele. O amigo pede orçamento pelo link e o pedido chega no seu painel já com quem indicou. Se o amigo procurar a loja direto, você registra em segundos.">
                <div className="space-y-3">
                  {[["Ana Paula", "indicada por Maria", "Nova"], ["Carlos Dias", "indicado por Bruno", "Orçamento"], ["Bia Lopes", "indicada por Maria", "Fechou"]].map(([n, q, e]) => (
                    <div key={n} className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                      <span><span className="block font-semibold">{n}</span><span className="text-sm text-black/50">{q}</span></span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${e === "Fechou" ? "bg-[#0a0a0a] text-white" : "bg-[#fff1e8] text-[#c24d00]"}`}>{e}</span>
                    </div>
                  ))}
                </div>
              </Passo>
              <Passo n={3} titulo="Multiplique suas vendas" texto="Você avança cada pedido até a venda. A comissão é calculada sozinha pela regra do produto e o Indiki+ cuida de pagar os indicadores por PIX no fim do mês.">
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                  <p className="font-semibold">Bia Lopes · Envidraçamento de sacada</p>
                  <div className="mt-4"><StageProgress stage="fechou" /></div>
                  <p className="mt-4 rounded-xl bg-[#fff1e8] px-4 py-2 text-sm">Comissão de Maria: <strong>R$ 300,00</strong>, liberada após a instalação</p>
                </div>
              </Passo>
            </ol>
            <div className="mt-14 text-center"><a href="#precos" className={laranja}>Começar agora</a></div>
          </div>
        </section>

        {/* Transformação */}
        <section id="resultados" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <span className={selo}>A transformação na prática</span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-[#ff6600] sm:text-5xl">A diferença entre fazer na mão e usar a ferramenta certa.</h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border-2 border-black/10 bg-[#f8f8f8] p-8">
                <p className="flex items-center gap-2 text-sm text-black/60"><span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden /> Gerenciando sem o Indiki+</p>
                <h3 className="mt-4 text-2xl font-bold">Complicado, manual e cheio de erros.</h3>
                <ul className="mt-6 space-y-4">
                  {[["Perder o controle", "de quem indicou em planilhas e conversas soltas."], ["Calcular e pagar comissões", "na mão, com risco de erro e atraso."], ["Falta de visibilidade", "para o cliente sobre o andamento do que ele indicou."]].map(([b, t]) => (
                    <li key={b} className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-100 text-red-600"><X size={14} aria-hidden /></span><span><strong>{b}</strong> <span className="text-black/60">{t}</span></span></li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-[#ff6600] p-8 text-white shadow-[0_20px_50px_-20px_rgba(255,102,0,0.8)]">
                <p className="flex items-center gap-2 text-sm text-white/85"><span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden /> Crescendo com o Indiki+</p>
                <h3 className="mt-4 text-2xl font-bold">Automatizado, transparente e eficiente.</h3>
                <ul className="mt-6 space-y-4">
                  {[["Painel central", "que acompanha cada indicação, do pedido à venda."], ["Comissão automática:", "você define a regra e a plataforma calcula."], ["Área exclusiva para os indicadores:", "eles acompanham as indicações e o que têm a receber."]].map(([b, t]) => (
                    <li key={b} className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/25"><Check size={14} aria-hidden /></span><span><strong>{b}</strong> <span className="text-white/85">{t}</span></span></li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-black/10 p-8">
                <Megaphone className="text-black/40" aria-hidden />
                <h3 className="mt-3 text-xl font-bold">Anúncios: o caminho caro e incerto</h3>
                <ul className="mt-4 space-y-2 text-black/60">
                  {["Custo por clique que só sobe", "Contatos frios, que ainda não conhecem você", "Dependência das plataformas", "Você paga mesmo quando não vende"].map((t) => <li key={t} className="flex gap-2"><X size={18} className="mt-0.5 shrink-0 text-red-500" aria-hidden />{t}</li>)}
                </ul>
              </div>
              <div className="rounded-3xl border-2 border-[#ff6600] bg-[#fff8f3] p-8">
                <Users className="text-[#ff6600]" aria-hidden />
                <h3 className="mt-3 text-xl font-bold">Indicações: o caminho inteligente</h3>
                <ul className="mt-4 space-y-2">
                  {["Contatos que já chegam com confiança", "Crescimento sustentável, com quem já é cliente", "Custo só sobre venda fechada", "Clientes viram parceiros da sua marca"].map((t) => <li key={t} className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0 text-[#ff6600]" aria-hidden />{t}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-20 bg-[#0a0a0a] py-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <span className={selo}>Recursos</span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">A solução completa para o seu negócio.</h2>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [Settings2, "Regra por produto", "Valor fixo, porcentagem ou os dois, com teto. Mudou a regra? Vale só para as próximas indicações."],
                [Link2, "Link e código únicos", "Cada indicador tem o seu, para mandar no WhatsApp com um toque."],
                [ClipboardList, "Funil das indicações", "Novas, orçamento, fechadas e instaladas, com aviso de cliente repetido."],
                [Wallet, "Comissões sem planilha", "Calculadas na hora de fechar e pagas aos indicadores por PIX pelo Indiki+."],
                [BadgeCheck, "Você aprova quem indica", "Convite por link, cadastro manual ou pedidos pelo site, com a sua aprovação."],
                [BarChart3, "Painel para o indicador", "Ele vê cada indicação, quanto tem a receber e quando, sem precisar te perguntar."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Check;
                return (
                  <div key={t as string} className="rounded-3xl bg-white/5 p-7 ring-1 ring-white/10">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff6600]"><I size={22} aria-hidden /></span>
                    <h3 className="mt-5 text-lg font-bold">{t as string}</h3>
                    <p className="mt-2 text-white/65">{d as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Preços */}
        <section id="precos" className="scroll-mt-20 bg-gradient-to-b from-[#fff8f3] to-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Escolha o plano ideal para o seu negócio.</h2>
              <p className="mt-4 text-black/60">Todos os planos têm acesso completo à plataforma. Você paga a mensalidade e uma pequena porcentagem só sobre o que vender por indicação.</p>
            </div>
            <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
              {precos.map((p) => (
                <div key={p.id} className={`relative flex flex-col rounded-3xl p-8 ${p.destaque ? "bg-[#0a0a0a] text-white shadow-2xl md:-my-4 md:py-12" : "bg-white shadow-[0_10px_40px_-15px_rgba(0,0,0,0.2)]"}`}>
                  {p.destaque && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ff6600] px-4 py-1 text-xs font-bold uppercase text-white">Mais popular{p.desconto > 0 ? ` · -${p.desconto}%` : ""}</span>}
                  <h3 className="text-xl font-bold">{p.nome}</h3>
                  <p className="mt-4"><span className="text-5xl font-bold tracking-tight">{brl0(p.mes)}</span><span className={p.destaque ? "text-white/60" : "text-black/50"}>/mês</span></p>
                  <p className={`mt-1 min-h-10 text-sm ${p.destaque ? "text-white/70" : "text-black/60"}`}>
                    {p.total ? <>Total de {brl0(p.total)}{p.economia ? <> · economia de <strong className="text-[#ff6600]">{brl0(p.economia)}</strong></> : null}</> : "Sem fidelidade"}
                  </p>
                  <p className={`mt-3 rounded-2xl px-4 py-2.5 text-sm ${p.destaque ? "bg-white/10" : "bg-[#fff3ea]"}`}>
                    + <strong>{p.taxa}</strong> sobre as vendas fechadas por indicação
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {INCLUSO.map((i) => <li key={i} className="flex gap-2"><Check size={18} className="shrink-0 text-[#ff6600]" aria-hidden />{i}</li>)}
                  </ul>
                  <Link href={`/cadastro-empresa?plano=${p.id}`} className={`${p.destaque ? laranja : preto} mt-8 w-full text-center`}>{p.cta}</Link>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-black/60"><ShieldCheck size={18} className="shrink-0 text-[#ff6600]" aria-hidden /> Você envia o pedido, nossa equipe entra em contato e libera o acesso da sua empresa.</p>
          </div>
        </section>

        {/* Indicadores */}
        <section className="px-4 py-16">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 rounded-3xl bg-[#f8f8f8] px-6 py-12 text-center md:flex-row md:text-left">
            <div className="flex-1">
              <h2 className="text-2xl font-bold sm:text-3xl">Você conhece boas empresas? Indique e ganhe.</h2>
              <p className="mt-2 text-black/60">Cadastre-se de graça, escolha as empresas parceiras e receba comissão por PIX a cada venda fechada.</p>
            </div>
            <Link href="/cadastro" className={preto}>Quero indicar <ArrowRight size={18} aria-hidden /></Link>
          </div>
        </section>

        {/* CTA final */}
        <section className="bg-[#ff6600] py-20 text-white">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Pare de queimar dinheiro com anúncios. Cresça com indicações.</h2>
            <a href="#precos" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#0a0a0a] px-8 py-3 text-base font-bold text-white hover:bg-black/80">Começar agora</a>
          </div>
        </section>
      </main>

      <footer className="bg-[#0a0a0a] py-10 text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-sm md:flex-row">
          <p className="text-lg font-bold text-white">indiki<span className="text-[#ff6600]">+</span></p>
          <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href="/entrar" className="hover:text-white">Entrar</Link>
            <Link href="/cadastro" className="hover:text-white">Quero indicar</Link>
            <Link href="/cadastro-empresa" className="hover:text-white">Cadastrar minha empresa</Link>
            <Link href="/termos" className="hover:text-white">Termos e dados</Link>
          </nav>
          <p>© 2026 indiki+. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function Passo({ n, titulo, texto, invertido, children }: { n: number; titulo: string; texto: string; invertido?: boolean; children: React.ReactNode }) {
  return (
    <li className="grid items-center gap-8 md:grid-cols-2">
      <div className={invertido ? "md:order-2" : ""}>
        <p className="text-sm font-semibold uppercase tracking-wide text-black/50">Passo {n}</p>
        <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#ff6600] sm:text-4xl">{titulo}</h3>
        <p className="mt-4 text-lg text-black/60">{texto}</p>
      </div>
      <div className={`rounded-3xl bg-[#f1f1f1] p-6 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.35)] ${invertido ? "md:order-1" : ""}`}>{children}</div>
    </li>
  );
}
