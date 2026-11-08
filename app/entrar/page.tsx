"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { PasswordInput } from "@/components/PasswordInput";
import { destinoAposEntrar, mensagemAuth } from "@/lib/auth";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const primary =
  "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";

type Tab = "entrar" | "criar";
type Modo = "senha" | "esqueci";

/** O código do convite pode vir colado como link inteiro ou só o código. */
function parseInvite(text: string) {
  const last = text.trim().split(/[/?#]/).filter(Boolean).pop() ?? "";
  const code = last.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return code.length >= 8 ? code : "";
}

export default function EntrarPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("entrar");
  const [modo, setModo] = useState<Modo>("senha");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [convite, setConvite] = useState("");
  const [erroConvite, setErroConvite] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!hasSupabase) return setErro("Este endereço ainda não está ligado ao sistema real.");
    setEnviando(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) { setEnviando(false); return setErro(mensagemAuth(error.message)); }
    router.replace(await destinoAposEntrar(sb, new URLSearchParams(location.search).get("destino")));
  }

  async function esqueci(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!hasSupabase) return setErro("Este endereço ainda não está ligado ao sistema real.");
    setEnviando(true);
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?destino=${encodeURIComponent("/redefinir-senha")}`,
    });
    setEnviando(false);
    if (error) return setErro(mensagemAuth(error.message));
    setSent(true); // mesma resposta exista ou não a conta (não revela quem tem cadastro)
  }

  function abrirConvite(e: React.FormEvent) {
    e.preventDefault();
    const code = parseInvite(convite);
    if (!code) return setErroConvite("Cole o link ou o código do convite que a empresa enviou.");
    router.push(`/convite/${code}`);
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${t}`}
      aria-selected={tab === t}
      aria-controls={`painel-${t}`}
      onClick={() => { setTab(t); setErro(""); setErroConvite(""); setSent(false); setModo("senha"); }}
      className={`flex-1 rounded-brand px-3 py-2 text-sm font-semibold ${tab === t ? "bg-white shadow-sm text-brand" : "text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
        <Card>
          <div role="tablist" aria-label="Acesso" className="grid grid-cols-2 gap-1 rounded-brand bg-brand-soft p-1">
            {tabBtn("entrar", "Entrar")}
            {tabBtn("criar", "Criar conta")}
          </div>

          {tab === "entrar" && modo === "senha" && (
            <form id="painel-entrar" role="tabpanel" aria-labelledby="tab-entrar" onSubmit={entrar} className="mt-5">
              <h1 className="text-xl font-semibold">Entrar na sua conta</h1>
              <label className="mt-4 block text-sm font-medium">
                E-mail
                <input required type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </label>
              <PasswordInput label="Senha" value={senha} onChange={setSenha} autoComplete="current-password" />
              <div className="mt-2 text-right">
                <button type="button" onClick={() => { setModo("esqueci"); setErro(""); setSent(false); }} className="text-sm font-medium text-brand underline">Esqueci minha senha</button>
              </div>
              <button type="submit" disabled={enviando} className={primary}>{enviando ? "Entrando…" : "Entrar"}</button>
              {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
              <p className="mt-4 text-center text-sm text-muted">
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => setTab("criar")} className="font-semibold text-brand underline">Criar conta</button>
              </p>
            </form>
          )}

          {tab === "entrar" && modo === "esqueci" && !sent && (
            <form id="painel-entrar" role="tabpanel" aria-labelledby="tab-entrar" onSubmit={esqueci} className="mt-5">
              <h1 className="text-xl font-semibold">Criar ou trocar a senha</h1>
              <p className="mt-1 text-sm text-muted">Informe o e-mail da sua conta. Enviamos um link para você definir uma senha nova. Use também se você ainda não tem senha.</p>
              <label className="mt-4 block text-sm font-medium">
                E-mail
                <input required type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </label>
              <button type="submit" disabled={enviando} className={primary}>{enviando ? "Enviando…" : "Enviar link para definir senha"}</button>
              {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
              <button type="button" onClick={() => { setModo("senha"); setErro(""); }} className="mt-4 w-full text-center text-sm font-semibold text-brand underline">Voltar para entrar</button>
            </form>
          )}

          {tab === "entrar" && modo === "esqueci" && sent && (
            <div className="mt-5 text-center">
              <MailCheck className="mx-auto text-brand" size={40} aria-hidden />
              <h1 className="mt-3 text-xl font-semibold">Confira seu e-mail</h1>
              <p className="mt-1 text-sm text-muted">Se existir uma conta com <strong>{email}</strong>, enviamos um link para definir a senha. Abra no mesmo aparelho e navegador. Vale por 1 hora. Se não achar, olhe o spam.</p>
              <button type="button" onClick={() => { setModo("senha"); setSent(false); }} className="mt-4 text-sm font-semibold text-brand underline">Voltar para entrar</button>
            </div>
          )}

          {tab === "criar" && (
            <div id="painel-criar" role="tabpanel" aria-labelledby="tab-criar" className="mt-5">
              <h1 className="text-xl font-semibold">Criar conta</h1>
              <p className="mt-1 text-sm text-muted">Recebeu um convite de uma empresa? Cole abaixo. Se não, escolha uma das opções.</p>

              <form onSubmit={abrirConvite} className="mt-4">
                <label className="block text-sm font-medium">
                  Tenho um convite
                  <input className={input} value={convite} onChange={(e) => setConvite(e.target.value)} placeholder="Cole o link ou o código do convite" autoComplete="off" />
                </label>
                {erroConvite && <p role="alert" className="mt-2 text-sm text-red-700">{erroConvite}</p>}
                <button type="submit" className={primary}>Continuar com o convite</button>
              </form>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/cadastro" className="rounded-brand border border-line p-3 text-sm hover:border-brand">
                  <strong className="block text-ink">Quero indicar</strong>
                  <span className="text-muted">Crie a conta e escolha as empresas que você conhece.</span>
                </Link>
                <Link href="/cadastro-empresa" className="rounded-brand border border-line p-3 text-sm hover:border-brand">
                  <strong className="block text-ink">Tenho uma empresa</strong>
                  <span className="text-muted">Peça o cadastro da sua empresa no Indiki+.</span>
                </Link>
              </div>
              <p className="mt-4 text-center text-sm text-muted">
                Já tem conta?{" "}
                <button type="button" onClick={() => setTab("entrar")} className="font-semibold text-brand underline">Entrar</button>
              </p>
            </div>
          )}
        </Card>
        <p className="mt-4 text-center text-xs text-muted">
          Ao continuar você concorda com os <Link href="/termos" className="underline">termos de uso e dados</Link>.
        </p>
      </main>
    </div>
  );
}
