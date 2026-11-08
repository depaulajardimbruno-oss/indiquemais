"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { useOrigin } from "@/components/useOrigin";
import { ContaPasso } from "@/components/indicador/ContaPasso";
import { FormCadastro } from "@/components/indicador/FormCadastro";

type Step = "carregando" | "invalido" | "conta" | "cadastro" | "pronto" | "indisponivel";

/** Convite da empresa: conta (criar ou entrar) -> cadastro completo -> código de indicação. */
export function ConviteFlow({ token }: { token: string }) {
  const origin = useOrigin();
  const [step, setStep] = useState<Step>(hasSupabase ? "carregando" : "indisponivel");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const iniciar = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: info } = await sb.rpc("invite_info", { p_token: token });
    const row = Array.isArray(info) ? info[0] : null;
    if (!row) return setStep("invalido");
    setCompany(row.company_name);
    if (!row.valid) return setStep("invalido");
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return setStep("conta");
    setEmail(sess.session.user.email ?? "");
    setStep("cadastro");
  }, [token]);

  useEffect(() => {
    if (!hasSupabase) return;
    void Promise.resolve().then(iniciar);
  }, [iniciar]);

  const link = `${origin}/i/${code}`;

  if (step === "carregando") return <Card><p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} aria-hidden /> Abrindo o convite…</p></Card>;
  if (step === "indisponivel") return <Card><h1 className="text-xl font-semibold">Cadastro indisponível neste ambiente</h1><p className="mt-1 text-sm text-muted">Use o endereço de produção do Indiki+.</p></Card>;
  if (step === "invalido") return (
    <Card className="text-center">
      <XCircle className="mx-auto text-rose-600" size={40} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Este convite não está mais ativo</h1>
      <p className="mt-1 text-sm text-muted">{company ? `Peça um link novo à ${company}.` : "Confira o link ou peça um novo à empresa que te convidou."}</p>
    </Card>
  );
  if (step === "conta") return (
    <ContaPasso destino={`/convite/${token}`} onEntrou={() => { setStep("carregando"); void iniciar(); }} topo={<>
      <p className="text-sm text-muted">{company} convidou você</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Indique amigos e ganhe comissão</h1>
      <p className="mt-2 text-sm text-muted">Cada amigo que fechar com a {company} por indicação sua rende uma comissão, paga por PIX.</p>
    </>} />
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
        <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* texto fica visível */ } }}
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand underline"><Copy size={14} aria-hidden /> {copied ? "Copiado" : "Copiar link"}</button>
      </div>
      <a href="/conta" className="mt-4 block text-center text-sm font-medium text-brand underline">Ver minhas empresas</a>
    </Card>
  );
  return (
    <FormCadastro token={token} email={email} botao={`Concluir e indicar a ${company}`} topo={<p className="text-sm text-muted">Convite da {company}</p>}
      onPronto={(c) => { setCode(c ?? ""); setStep("pronto"); }} />
  );
}
