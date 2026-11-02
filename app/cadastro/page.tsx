"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, PrototypeBanner } from "@/components/ui";
import { companies } from "@/lib/indicador";

const input =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

/** Cliente pede acesso por conta própria. A empresa confere e libera (tela Indicadores). */
export default function CadastroPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState(companies[0].id);
  const company = companies.find((c) => c.id === companyId)!;

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
              <h1 className="text-xl font-semibold">Pedir acesso para indicar</h1>
              <p className="mt-1 text-sm text-muted">
                Para indicar, você precisa ser cliente de uma empresa parceira. Ela confere seu cadastro
                e libera o seu link.
              </p>
              <label className="mt-4 block text-sm font-medium">
                Sou cliente da empresa
                <select className={input} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Seu nome
                <input required autoComplete="name" className={input} placeholder="Nome e sobrenome" />
              </label>
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
              <label className="mt-4 block text-sm font-medium">
                Seu telefone (WhatsApp)
                <input required type="tel" autoComplete="tel" className={input} placeholder="(00) 00000-0000" />
              </label>
              <label className="mt-4 flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" required className="mt-0.5" />
                <span>Concordo que a {company.name} e o Indiki+ usem meus dados para liberar meu acesso.</span>
              </label>
              <button
                type="submit"
                className="mt-5 w-full rounded-brand bg-brand px-4 py-3 text-base font-semibold text-brand-fg hover:opacity-90"
              >
                Pedir acesso
              </button>
              <p className="mt-4 text-center text-sm text-muted">
                Já tem acesso? <Link href="/entrar" className="font-semibold text-brand">Entrar</Link>
              </p>
            </form>
          ) : (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-brand" size={40} aria-hidden />
              <h1 className="mt-3 text-xl font-semibold">Pedido enviado</h1>
              <p className="mt-1 text-sm text-muted">
                A {company.name} vai conferir seu cadastro e liberar o seu link. Quando liberar, entre em{" "}
                <strong>Entrar</strong> com o e-mail <strong>{email}</strong>.
              </p>
              <p className="mt-3 text-xs text-muted">Protótipo: nenhum dado foi enviado ou salvo.</p>
              <Link
                href="/entrar"
                className="mt-5 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-medium text-brand-fg"
              >
                Ir para Entrar
              </Link>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
