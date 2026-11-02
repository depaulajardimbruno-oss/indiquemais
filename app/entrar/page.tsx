"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Card, PrototypeBanner } from "@/components/ui";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

export default function EntrarPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-screen flex-col">
      <PrototypeBanner />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
        <Card>
          {!sent ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
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
                Enviar link de acesso
              </button>
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
                No sistema real, enviaríamos o link para <strong>{email}</strong>. Neste protótipo,
                nenhum e-mail é enviado.
              </p>
              <Link
                href="/indicador"
                className="mt-5 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg"
              >
                Abrir painel de exemplo
              </Link>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
