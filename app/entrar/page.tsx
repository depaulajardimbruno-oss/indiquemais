"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

export default function EntrarPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro("");
    if (!hasSupabase) return setSent(true); // protótipo: não envia nada
    setEnviando(true);
    const destino = new URLSearchParams(location.search).get("destino");
    const volta = `${location.origin}/auth/callback${destino ? `?destino=${encodeURIComponent(destino)}` : ""}`;
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: volta } });
    setEnviando(false);
    if (error) return setErro("Não conseguimos enviar o link agora. Confira o e-mail e tente de novo em alguns minutos.");
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
        <Card>
          {!sent ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <h1 className="text-xl font-semibold">Entrar ou criar conta grátis</h1>
              <p className="mt-1 text-sm text-muted">
                Informe seu e-mail. Enviamos um link para entrar, sem senha. Se for sua primeira vez, a conta é criada na hora.
              </p>
              <label className="mt-4 block text-sm font-medium">
                Seu e-mail
                <input
                  required
                  type="email"
                  autoComplete="email"
                  className={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </label>
              <fieldset className="mt-4">
                <legend className="text-sm font-medium">Eu sou</legend>
                <label className="mt-2 flex items-center gap-3 rounded-brand border border-line p-3 text-sm">
                  <input type="radio" name="perfil" defaultChecked /> Cliente: indico o que uso e gosto
                </label>
                <label className="mt-2 flex items-center gap-3 rounded-brand border border-line p-3 text-sm">
                  <input type="radio" name="perfil" /> Profissional: arquiteto, designer ou parceiro
                </label>
              </fieldset>
              <button
                type="submit"
                className="mt-4 w-full rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg hover:opacity-90"
              >
                {enviando ? "Enviando…" : "Enviar link de acesso"}
              </button>
              {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
              <p className="mt-4 rounded-brand bg-brand-soft p-3 text-xs text-muted">
                Criar conta e indicar é gratuito. Você recebe um link ou código exclusivo para
                compartilhar.
              </p>
              <p className="mt-3 text-center text-sm text-muted">
                Cliente de uma empresa parceira e ainda sem acesso?{" "}
                <Link href="/cadastro" className="font-semibold text-brand">Peça seu acesso</Link>
              </p>
            </form>
          ) : (
            <div className="text-center">
              <MailCheck className="mx-auto text-brand" size={40} aria-hidden />
              <h1 className="mt-3 text-xl font-semibold">Confira seu e-mail</h1>
              <p className="mt-1 text-sm text-muted">
                {hasSupabase
                  ? <>Enviamos um link para <strong>{email}</strong>. Abra no mesmo aparelho e navegador em que pediu. Vale por 1 hora.</>
                  : <>No sistema real, enviaríamos o link para <strong>{email}</strong>. Neste protótipo, nenhum e-mail é enviado.</>}
              </p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
