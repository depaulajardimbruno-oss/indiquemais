"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const primary =
  "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";

type Tab = "entrar" | "criar";

/** O código do convite pode vir colado como link inteiro ou só o código. */
function parseInvite(text: string) {
  const last = text.trim().split(/[/?#]/).filter(Boolean).pop() ?? "";
  const code = last.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return code.length >= 8 ? code : "";
}

export default function EntrarPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("entrar");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [convite, setConvite] = useState("");
  const [erroConvite, setErroConvite] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!hasSupabase) return setErro("Este endereço ainda não está ligado ao sistema real.");
    setEnviando(true);
    const destino = new URLSearchParams(location.search).get("destino");
    const volta = `${location.origin}/auth/callback${destino ? `?destino=${encodeURIComponent(destino)}` : ""}`;
    // shouldCreateUser: false = só entra quem já tem conta. Conta nova nasce pelo convite.
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: volta, shouldCreateUser: false },
    });
    setEnviando(false);
    if (error) {
      const semConta = /signups? not allowed|not allowed for otp|user not found/i.test(error.message);
      return setErro(
        semConta
          ? "Não encontramos uma conta com este e-mail. Se você recebeu um convite de uma empresa, abra o link do convite para criar a sua conta."
          : "Não conseguimos enviar o link agora. Confira o e-mail e tente de novo em alguns minutos.",
      );
    }
    setSent(true);
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
      onClick={() => { setTab(t); setErro(""); setErroConvite(""); setSent(false); }}
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

          {tab === "entrar" && !sent && (
            <form id="painel-entrar" role="tabpanel" aria-labelledby="tab-entrar" onSubmit={entrar} className="mt-5">
              <h1 className="text-xl font-semibold">Entrar na sua conta</h1>
              <p className="mt-1 text-sm text-muted">Informe o e-mail da sua conta. Enviamos um link para você entrar, sem senha.</p>
              <label className="mt-4 block text-sm font-medium">
                Seu e-mail
                <input required type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </label>
              <button type="submit" disabled={enviando} className={primary}>{enviando ? "Enviando…" : "Enviar link de acesso"}</button>
              {erro && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {erro}{" "}
                  {erro.startsWith("Não encontramos") && (
                    <button type="button" onClick={() => setTab("criar")} className="font-semibold underline">Ver como criar conta</button>
                  )}
                </p>
              )}
              <p className="mt-4 text-center text-sm text-muted">
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => setTab("criar")} className="font-semibold text-brand underline">Criar conta</button>
              </p>
            </form>
          )}

          {tab === "entrar" && sent && (
            <div className="mt-5 text-center">
              <MailCheck className="mx-auto text-brand" size={40} aria-hidden />
              <h1 className="mt-3 text-xl font-semibold">Confira seu e-mail</h1>
              <p className="mt-1 text-sm text-muted">Enviamos um link para <strong>{email}</strong>. Abra no mesmo aparelho e navegador em que pediu. Vale por 1 hora. Se não achar, olhe o spam.</p>
              <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-brand underline">Usar outro e-mail</button>
            </div>
          )}

          {tab === "criar" && (
            <div id="painel-criar" role="tabpanel" aria-labelledby="tab-criar" className="mt-5">
              <h1 className="text-xl font-semibold">Criar conta</h1>
              <p className="mt-1 text-sm text-muted">A conta nasce a partir do convite de uma empresa parceira. É grátis para quem indica.</p>

              <form onSubmit={abrirConvite} className="mt-4">
                <label className="block text-sm font-medium">
                  Tenho um convite
                  <input className={input} value={convite} onChange={(e) => setConvite(e.target.value)} placeholder="Cole o link ou o código do convite" autoComplete="off" />
                </label>
                {erroConvite && <p role="alert" className="mt-2 text-sm text-red-700">{erroConvite}</p>}
                <button type="submit" className={primary}>Continuar com o convite</button>
              </form>

              <div className="mt-5 space-y-3 rounded-brand bg-brand-soft p-3 text-sm">
                <p><strong>Sou cliente de uma empresa parceira.</strong> Peça a ela o link de convite. Você confirma o e-mail, preenche o cadastro e já recebe o seu código de indicação.</p>
                <p><strong>Tenho uma empresa e quero participar.</strong> O cadastro de empresas é feito pela equipe do Indiki+. Em breve haverá um formulário aqui.</p>
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
