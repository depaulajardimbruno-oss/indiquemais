"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, MailCheck, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { PIX_TYPES, TERMS_VERSION, UFS, maskCpf, maskPhone, maxBirthDate, onlyDigits, validCpf, type PixType } from "@/lib/cadastro";
import { useOrigin } from "@/components/useOrigin";

const field =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btn =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";

type Step = "carregando" | "invalido" | "email" | "enviado" | "cadastro" | "pronto" | "indisponivel";

/** Convite da empresa: e-mail -> link no e-mail -> cadastro completo -> código de indicação. */
export function ConviteFlow({ token }: { token: string }) {
  const origin = useOrigin();
  const [step, setStep] = useState<Step>(hasSupabase ? "carregando" : "indisponivel");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const [cpfSalvo, setCpfSalvo] = useState(false);
  const [f, setF] = useState({
    name: "", phone: "", birth: "", city: "", uf: "SP", cpf: "",
    pixType: "cpf" as PixType, pixKey: "", kind: "cliente", terms: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = supabaseBrowser();
    (async () => {
      const { data: info } = await sb.rpc("invite_info", { p_token: token });
      const row = Array.isArray(info) ? info[0] : null;
      if (!row) return setStep("invalido");
      setCompany(row.company_name);
      if (!row.valid) return setStep("invalido");
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) return setStep("email");
      setEmail(sess.session.user.email ?? "");
      // Já tem cadastro completo? Pré-preenche e deixa só confirmar.
      const { data: me } = await sb.from("indicator_my_profile").select("*").maybeSingle();
      if (me?.completed) {
        setCpfSalvo(Boolean(me.cpf_masked));
        setF((p) => ({
          ...p, name: me.full_name ?? "", phone: me.phone ?? "", birth: me.birth_date ?? "", city: me.city ?? "", uf: me.state ?? "SP",
          cpf: me.cpf_masked ?? "", pixType: (me.pix_key_type ?? "cpf") as PixType, pixKey: me.pix_key ?? "", kind: me.profile_kind ?? "cliente",
        }));
      }
      setStep("cadastro");
    })();
  }, [token]);

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback?destino=${encodeURIComponent(`/convite/${token}`)}` },
    });
    setBusy(false);
    if (error) return setErro("Não conseguimos enviar o link agora. Confira o e-mail e tente de novo em alguns minutos.");
    setStep("enviado");
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (f.name.trim().split(/\s+/).length < 2) return setErro("Informe o nome completo, como está no documento.");
    if (onlyDigits(f.phone).length < 10) return setErro("Informe o telefone com DDD.");
    if (!f.birth || f.birth > maxBirthDate(new Date())) return setErro("Para receber comissões é preciso ter 18 anos ou mais.");
    if (!cpfSalvo && !validCpf(f.cpf)) return setErro("CPF inválido. Confira os números.");
    if (!f.pixKey.trim()) return setErro("Informe a chave PIX para receber.");
    if (!f.terms) return setErro("Aceite os termos para continuar.");
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("indicator_register", {
      p_token: token, p_full_name: f.name, p_phone: f.phone, p_birth_date: f.birth, p_city: f.city, p_state: f.uf,
      p_cpf: cpfSalvo ? "" : f.cpf, p_pix_type: f.pixType, p_pix_key: f.pixKey, p_profile_kind: f.kind,
      p_terms_version: TERMS_VERSION, p_accept_terms: f.terms,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    setCode(String(data));
    setStep("pronto");
  }

  const link = `${origin}/i/${code}`;
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* texto fica visível */ }
  }

  if (step === "carregando") return <Card><p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} aria-hidden /> Abrindo o convite…</p></Card>;

  if (step === "indisponivel") return <Card><h1 className="text-xl font-semibold">Cadastro indisponível neste ambiente</h1><p className="mt-1 text-sm text-muted">Este endereço ainda não está ligado ao sistema real. Use o endereço de produção do Indiki+.</p></Card>;

  if (step === "invalido") return (
    <Card className="text-center">
      <XCircle className="mx-auto text-rose-600" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Este convite não está mais ativo</h1>
      <p className="mt-1 text-sm text-muted">{company ? `Peça um link novo à ${company}.` : "Confira o link ou peça um novo à empresa que te convidou."}</p>
    </Card>
  );

  if (step === "email") return (
    <Card>
      <p className="text-sm text-muted">{company} convidou você</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Indique amigos e ganhe comissão</h1>
      <p className="mt-2 text-sm text-muted">Cada amigo que fechar com a {company} por indicação seu rende uma comissão, paga por PIX. Primeiro, confirme o seu e-mail: enviamos um link para você continuar.</p>
      <form onSubmit={enviarLink} className="mt-4">
        <label className="block text-sm font-medium">Seu e-mail
          <input required type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        </label>
        <button type="submit" disabled={busy} className={`${btn} mt-4`}>{busy ? "Enviando…" : "Enviar link para o meu e-mail"}</button>
        {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      </form>
    </Card>
  );

  if (step === "enviado") return (
    <Card className="text-center">
      <MailCheck className="mx-auto text-brand" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Veja o seu e-mail</h1>
      <p className="mt-1 text-sm text-muted">Enviamos um link para <strong>{email}</strong>. Abra no mesmo aparelho e navegador em que você está agora. Vale por 1 hora. Se não achar, olhe o spam.</p>
    </Card>
  );

  if (step === "pronto") return (
    <Card>
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={44} aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold">Cadastro concluído</h1>
        <p className="mt-1 text-sm text-muted">Você agora indica a {company}. Seu código é <strong className="font-mono">{code}</strong>.</p>
      </div>
      <div className="mt-4 rounded-brand bg-brand-soft p-3 text-sm">
        <p className="font-medium">Seu link de indicação</p>
        <p className="mt-1 break-all font-mono text-xs">{link}</p>
        <button onClick={copiar} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand underline"><Copy size={14} aria-hidden /> {copied ? "Copiado" : "Copiar link"}</button>
      </div>
      <p className="mt-4 text-center text-sm text-muted">Guarde o seu link e o seu código. O painel para acompanhar indicações e comissões chega em breve; você entra com este mesmo e-mail.</p>
    </Card>
  );

  // cadastro completo
  return (
    <Card>
      <p className="text-sm text-muted">Convite da {company}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Complete o seu cadastro</h1>
      <p className="mt-2 text-sm text-muted">Precisamos destes dados para pagar suas comissões e emitir o informe de rendimentos. Conta de <strong>{email}</strong>.</p>
      <form onSubmit={cadastrar} className="mt-4 space-y-4" noValidate>
        <label className="block text-sm font-medium">Nome completo
          <input required autoComplete="name" className={field} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Como está no seu documento" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">CPF
            <input required inputMode="numeric" autoComplete="off" className={field} value={f.cpf} readOnly={cpfSalvo} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
            {cpfSalvo && <span className="mt-1 block text-xs font-normal text-muted">Já cadastrado. Para trocar, fale com o suporte.</span>}
          </label>
          <label className="block text-sm font-medium">Data de nascimento
            <input required type="date" autoComplete="bday" className={field} value={f.birth} max={maxBirthDate(new Date())} onChange={(e) => set("birth", e.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-medium">Telefone (WhatsApp)
          <input required type="tel" autoComplete="tel" className={field} value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-4">
          <label className="block text-sm font-medium">Cidade
            <input required autoComplete="address-level2" className={field} value={f.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label className="block text-sm font-medium">UF
            <select className={field} value={f.uf} onChange={(e) => set("uf", e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Você é</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[["cliente", "Cliente da empresa"], ["profissional", "Profissional (arquiteto, engenheiro…)"]].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-brand border px-3 py-2 text-center text-sm ${f.kind === v ? "border-brand bg-brand-soft font-medium" : "border-line"}`}>
                <input type="radio" name="kind" value={v} checked={f.kind === v} onChange={() => set("kind", v)} className="sr-only" />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <label className="block text-sm font-medium">Tipo da chave PIX
            <select className={field} value={f.pixType} onChange={(e) => set("pixType", e.target.value as PixType)}>
              {PIX_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Chave PIX para receber
            <input required className={field} value={f.pixKey} onChange={(e) => set("pixKey", e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-muted">{PIX_TYPES.find((p) => p.value === f.pixType)?.hint}</span>
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} />
          <span>Li e aceito os <Link href="/termos" target="_blank" className="font-medium text-brand underline">termos de uso e o tratamento dos meus dados</Link>.</span>
        </label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <button type="submit" disabled={busy} className={btn}>{busy ? "Salvando…" : `Concluir e indicar a ${company}`}</button>
      </form>
    </Card>
  );
}
