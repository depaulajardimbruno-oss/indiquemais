"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { MIN_PASSWORD, mensagemAuth, validarSenha } from "@/lib/auth";

const btn = "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";
type Info = { company_name: string; email: string; role: string; valid: boolean };
type Passo = "carregando" | "invalido" | "conta" | "enviado" | "outro-email" | "aceitando";

/** Convite de acesso ao painel da empresa: cria a conta com senha (ou entra) e aceita. */
export function AcessoFlow({ token }: { token: string }) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>(hasSupabase ? "carregando" : "invalido");
  const [info, setInfo] = useState<Info | null>(null);
  const [temConta, setTemConta] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [logado, setLogado] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const aceitar = useCallback(async () => {
    setPasso("aceitando");
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("accept_access_invite", { p_token: token });
    if (error) { setErro(error.message); setPasso("conta"); return; }
    router.replace("/empresa");
  }, [token, router]);

  const iniciar = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.rpc("access_invite_info", { p_token: token });
    const row = Array.isArray(data) ? (data[0] as Info | undefined) : undefined;
    if (!row || !row.valid) { setInfo(row ?? null); return setPasso("invalido"); }
    setInfo(row);
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return setPasso("conta");
    const atual = (s.session.user.email ?? "").toLowerCase();
    if (atual !== row.email) { setLogado(atual); return setPasso("outro-email"); }
    await aceitar();
  }, [token, aceitar]);

  useEffect(() => {
    if (!hasSupabase) return;
    void Promise.resolve().then(iniciar);
  }, [iniciar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setErro("");
    const sb = supabaseBrowser();
    if (temConta) {
      setBusy(true);
      const { error } = await sb.auth.signInWithPassword({ email: info.email, password: senha });
      setBusy(false);
      if (error) return setErro(mensagemAuth(error.message));
      return void aceitar();
    }
    const v = validarSenha(senha, confirma);
    if (v) return setErro(v);
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: info.email, password: senha,
      options: { emailRedirectTo: `${location.origin}/auth/callback?destino=${encodeURIComponent(`/acesso/${token}`)}` },
    });
    setBusy(false);
    if (error) return setErro(mensagemAuth(error.message));
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setTemConta(true);
      return setErro("Este e-mail já tem conta. Entre com a sua senha.");
    }
    if (data.session) return void aceitar();
    setPasso("enviado");
  }

  if (passo === "carregando" || passo === "aceitando") return <Card><p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} aria-hidden /> {passo === "aceitando" ? "Liberando o seu acesso…" : "Abrindo o convite…"}</p></Card>;
  if (passo === "invalido") return (
    <Card className="text-center">
      <XCircle className="mx-auto text-rose-600" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Convite indisponível</h1>
      <p className="mt-1 text-sm text-muted">Este link venceu, já foi usado ou foi cancelado. Peça um novo{info ? ` para o acesso à ${info.company_name}` : ""}.</p>
    </Card>
  );
  if (passo === "enviado") return (
    <Card className="text-center">
      <MailCheck className="mx-auto text-brand" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Confirme o seu e-mail</h1>
      <p className="mt-1 text-sm text-muted">Enviamos um link para <strong>{info?.email}</strong>. Abra no mesmo aparelho e navegador para entrar no painel da {info?.company_name}. Se não achar, olhe o spam.</p>
    </Card>
  );
  if (passo === "outro-email") return (
    <Card>
      <h1 className="text-xl font-semibold">Este convite é para outro e-mail</h1>
      <p className="mt-1 text-sm text-muted">Você entrou como <strong>{logado}</strong>, mas o acesso à {info?.company_name} foi liberado para <strong>{info?.email}</strong>.</p>
      <button className={btn} onClick={async () => { await supabaseBrowser().auth.signOut(); setPasso("conta"); }}>Sair e continuar com {info?.email}</button>
    </Card>
  );

  return (
    <Card>
      <p className="text-sm text-muted">Acesso ao painel da empresa</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{info?.company_name}</h1>
      <p className="mt-2 text-sm text-muted">Você foi liberado como <strong>{info?.role === "admin" ? "administrador" : "operador"}</strong>. {temConta ? "Entre com a sua senha para continuar." : "Crie a sua senha para entrar."}</p>
      <div role="tablist" aria-label="Conta" className="mt-4 grid grid-cols-2 gap-1 rounded-brand bg-brand-soft p-1">
        {([[false, "Criar senha"], [true, "Já tenho conta"]] as const).map(([v, l]) => (
          <button key={l} type="button" role="tab" aria-selected={temConta === v} onClick={() => { setTemConta(v); setErro(""); }}
            className={`rounded-brand px-3 py-2 text-sm font-semibold ${temConta === v ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      <form onSubmit={enviar}>
        <label className="mt-4 block text-sm font-medium">E-mail
          <input readOnly value={info?.email ?? ""} className="mt-1 w-full rounded-brand border border-line bg-surface px-3 py-3 text-base text-muted" />
        </label>
        <PasswordInput label={temConta ? "Senha" : "Crie uma senha"} value={senha} onChange={setSenha} autoComplete={temConta ? "current-password" : "new-password"} hint={temConta ? undefined : `Pelo menos ${MIN_PASSWORD} caracteres, com letras e números.`} />
        {!temConta && <PasswordInput label="Repita a senha" value={confirma} onChange={setConfirma} autoComplete="new-password" />}
        {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
        <button type="submit" disabled={busy} className={btn}>{busy ? "Aguarde…" : temConta ? "Entrar e acessar" : "Criar conta e acessar"}</button>
      </form>
    </Card>
  );
}
