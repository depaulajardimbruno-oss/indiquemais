"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MIN_PASSWORD, mensagemAuth, validarSenha } from "@/lib/auth";

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btn = "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";

/** Criar conta (e-mail + senha, com confirmação por e-mail) ou entrar. Depois volta para `destino`. */
export function ContaPasso({ topo, destino, onEntrou }: { topo: React.ReactNode; destino: string; onEntrou: () => void }) {
  const [temConta, setTemConta] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const sb = supabaseBrowser();
    if (temConta) {
      setBusy(true);
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
      setBusy(false);
      if (error) return setErro(mensagemAuth(error.message));
      return onEntrou();
    }
    const v = validarSenha(senha, confirma);
    if (v) return setErro(v);
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: email.trim(), password: senha,
      options: { emailRedirectTo: `${location.origin}/auth/callback?destino=${encodeURIComponent(destino)}` },
    });
    setBusy(false);
    if (error) return setErro(mensagemAuth(error.message));
    // E-mail já cadastrado: o Supabase devolve um usuário sem identidades (não revela a conta).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setTemConta(true);
      return setErro("Este e-mail já tem conta. Entre com a sua senha para continuar.");
    }
    if (data.session) return onEntrou();
    setEnviado(true);
  }

  if (enviado) return (
    <Card className="text-center">
      <MailCheck className="mx-auto text-brand" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Confirme o seu e-mail</h1>
      <p className="mt-1 text-sm text-muted">Enviamos um link para <strong>{email}</strong>. Abra no mesmo aparelho e navegador em que você está agora para continuar. Se não achar, olhe o spam.</p>
    </Card>
  );

  return (
    <Card>
      {topo}
      <div role="tablist" aria-label="Conta" className="mt-4 grid grid-cols-2 gap-1 rounded-brand bg-brand-soft p-1">
        {([[false, "Criar conta"], [true, "Já tenho conta"]] as const).map(([v, l]) => (
          <button key={l} type="button" role="tab" aria-selected={temConta === v} onClick={() => { setTemConta(v); setErro(""); }}
            className={`rounded-brand px-3 py-2 text-sm font-semibold ${temConta === v ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      <form onSubmit={enviar} className="mt-2">
        <label className="mt-2 block text-sm font-medium">E-mail
          <input required type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        </label>
        <PasswordInput label={temConta ? "Senha" : "Crie uma senha"} value={senha} onChange={setSenha} autoComplete={temConta ? "current-password" : "new-password"} hint={temConta ? undefined : `Pelo menos ${MIN_PASSWORD} caracteres, com letras e números.`} />
        {!temConta && <PasswordInput label="Repita a senha" value={confirma} onChange={setConfirma} autoComplete="new-password" />}
        <button type="submit" disabled={busy} className={btn}>{busy ? "Aguarde…" : temConta ? "Entrar e continuar" : "Criar conta"}</button>
        {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
        {temConta && <p className="mt-3 text-center text-sm"><Link href="/entrar" className="text-brand underline">Esqueci minha senha</Link></p>}
        {!temConta && <p className="mt-3 text-xs text-muted">Depois de criar, enviamos um e-mail para confirmar que ele é seu. Em seguida você completa o cadastro.</p>}
      </form>
    </Card>
  );
}
