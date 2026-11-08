"use client";

import { useRef, useState } from "react";
import { Check, Copy, MessageCircle, UserPlus, X } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { ConviteCard } from "@/components/empresa/ConviteCard";
import { PILOT_COMPANY } from "@/lib/mock";
import {
  genCode,
  initialIndicators,
  initialRequests,
  normPhone,
  type AccessRequest,
  type Indicator,
} from "@/lib/indicadores-empresa";

const field =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90";
const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-brand border border-line bg-white px-4 py-3 text-sm font-medium hover:bg-brand-soft";

/** Cartão "aqui está o acesso do cliente": link, código e mensagem pronta para WhatsApp. */
function AccessCard({ who, onClose }: { who: Indicator; onClose: () => void }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const link = `${origin}/i/${who.code}`;
  const first = who.name.split(" ")[0];
  const msg =
    `Olá, ${first}! Você agora pode indicar amigos e vizinhos da ${PILOT_COMPANY} e ganhar comissão pelo Indiki+.\n\n` +
    `Seu código: ${who.code}\nSeu link: ${link}\n\n` +
    (who.email ? `Para acompanhar suas indicações, entre em ${origin}/entrar com o e-mail ${who.email}.` : "");
  const digits = who.phone ? normPhone(who.phone) : null;
  const wa = `https://wa.me/${digits ? `55${digits}` : ""}?text=${encodeURIComponent(msg)}`;

  async function copy(what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : who.code);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* sem permissão: o texto continua visível para copiar à mão */
    }
  }

  return (
    <Card className="border-2 border-accent bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Acesso liberado para {who.name}</h2>
          <p className="text-sm text-muted">Passe o código ou o link para o cliente. Ele serve só para a {PILOT_COMPANY}.</p>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="rounded-brand p-2 hover:bg-brand-soft">
          <X size={18} aria-hidden />
        </button>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <dt className="text-xs text-muted">Código do indicador</dt>
          <dd className="mt-1 rounded-brand bg-brand-soft px-4 py-3 font-mono text-2xl font-bold tracking-wider text-brand">
            {who.code}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">Link pessoal</dt>
          <dd className="mt-1 break-all rounded-brand bg-surface px-3 py-3 font-mono text-sm ring-1 ring-line">
            {link || `/i/${who.code}`}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => copy("code")} className={btnSecondary}>
          {copied === "code" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied === "code" ? "Código copiado" : "Copiar código"}
        </button>
        <button onClick={() => copy("link")} className={btnSecondary}>
          {copied === "link" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied === "link" ? "Link copiado" : "Copiar link"}
        </button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
          <MessageCircle size={16} aria-hidden />
          Enviar por WhatsApp
        </a>
      </div>
      <p className="mt-3 text-xs text-muted">
        {who.email
          ? `O cliente entra no painel com o e-mail ${who.email}. No primeiro acesso, o cadastro se liga ao código automaticamente.`
          : "Sem e-mail cadastrado, o cliente ainda não consegue entrar no painel, mas o código e o link já funcionam."}
      </p>
    </Card>
  );
}

export default function IndicadoresPage() {
  const [list, setList] = useState<Indicator[]>(initialIndicators);
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);
  const [shown, setShown] = useState<Indicator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const seq = useRef(0);

  function register(name: string, email: string, phone: string): Indicator | string {
    const e = email.trim().toLowerCase();
    const digits = phone.trim() ? normPhone(phone) : null;
    if (!name.trim()) return "Informe o nome do cliente.";
    if (!e && !digits) return "Informe o e-mail (para ele entrar no painel) ou o telefone com DDD.";
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return "E-mail inválido.";
    if (phone.trim() && !digits) return "Telefone inválido: use DDD + número.";
    if (list.some((i) => (e && i.email === e) || (digits && i.phone && normPhone(i.phone) === digits))) {
      return "Este cliente já está cadastrado (mesmo e-mail ou telefone).";
    }
    const created: Indicator = {
      id: `novo-${++seq.current}`,
      name: name.trim(),
      email: e || null,
      phone: phone.trim() || null,
      code: genCode(name, list.map((i) => i.code)),
      hasAccount: false,
      active: true,
      referrals: 0,
    };
    return created;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const r = register(form.name, form.email, form.phone);
    if (typeof r === "string") return setError(r);
    setError(null);
    setList((prev) => [r, ...prev]);
    setShown(r);
    setForm({ name: "", email: "", phone: "" });
  }

  function approve(req: AccessRequest) {
    const r = register(req.name, req.email, req.phone);
    if (typeof r === "string") return setError(r);
    setError(null);
    setList((prev) => [r, ...prev]);
    setRequests((prev) => prev.filter((x) => x.id !== req.id));
    setShown(r);
  }

  const pending = requests.filter((r) => r.state === "pendente");

  return (
    <>
      <PageHeader
        title="Indicadores"
        subtitle="Clientes que podem indicar amigos e ganhar comissão nos seus produtos."
      />
      <ConviteCard />

      {shown && (
        <div className="mb-6">
          <AccessCard who={shown} onClose={() => setShown(null)} />
        </div>
      )}

      {pending.length > 0 && (
        <Card className="mb-6">
          <h2 className="font-semibold">Pedidos de acesso pelo site ({pending.length})</h2>
          <p className="mt-1 text-sm text-muted">
            Estas pessoas pediram para indicar. Confira se são clientes de verdade antes de liberar.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-sm text-muted">
                    {r.email} · {r.phone}
                  </p>
                  <p className="text-sm text-muted">{r.note}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(r)} className={btnPrimary}>
                    <Check size={16} aria-hidden /> Liberar
                  </button>
                  <button
                    onClick={() => setRequests((prev) => prev.filter((x) => x.id !== r.id))}
                    className={btnSecondary}
                  >
                    Recusar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <UserPlus size={18} aria-hidden /> Liberar um cliente para indicar
        </h2>
        <p className="mt-1 text-sm text-muted">
          Cadastre quem já fechou com a {PILOT_COMPANY}. O sistema cria o código e o link dele na hora.
        </p>
        <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
          <label className="block text-sm font-medium sm:col-span-2">
            Nome do cliente
            <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" placeholder="Nome e sobrenome" />
          </label>
          <label className="block text-sm font-medium">
            E-mail (para entrar no painel)
            <input className={field} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" placeholder="cliente@email.com" />
          </label>
          <label className="block text-sm font-medium">
            Telefone com DDD (WhatsApp)
            <input className={field} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="off" placeholder="(00) 00000-0000" />
          </label>
          {error && (
            <p role="alert" className="rounded-brand bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              Liberar acesso e gerar código
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted">
          O telefone ajuda quando um amigo diz “fui indicado pelo fulano” sem usar o link: é por ele
          que o sistema acha o indicador.
        </p>
      </Card>

      <h2 className="mb-3 font-semibold">Seus indicadores ({list.length})</h2>
      <ul className="space-y-3">
        {list.map((i) => (
          <li key={i.id}>
            <Card className={`p-4 ${i.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-muted">
                    {[i.email, i.phone].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-brand bg-brand-soft px-2 py-0.5 font-mono font-semibold text-brand">
                      {i.code}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        i.hasAccount ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {i.hasAccount ? "Já entrou no painel" : "Ainda não entrou"}
                    </span>
                    <span className="text-muted">{i.referrals} indicações</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShown(i)} className={btnSecondary}>
                    Ver link e código
                  </button>
                  <button
                    onClick={() => setList((prev) => prev.map((x) => (x.id === i.id ? { ...x, active: !x.active } : x)))}
                    className={btnSecondary}
                  >
                    {i.active ? "Pausar" : "Reativar"}
                  </button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">
        Protótipo: nada é salvo. Pausar um indicador não apaga nada: as indicações e comissões dele
        continuam registradas.
      </p>
    </>
  );
}
