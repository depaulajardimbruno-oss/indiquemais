"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { ContaPasso } from "@/components/indicador/ContaPasso";
import { FormCadastro } from "@/components/indicador/FormCadastro";
import { Vitrine } from "@/components/indicador/Vitrine";

type Step = "carregando" | "conta" | "cadastro" | "empresas" | "indisponivel";

/** Cadastro de indicador pelo site: conta -> cadastro completo -> escolher empresas. */
export function CadastroFlow() {
  const [step, setStep] = useState<Step>(hasSupabase ? "carregando" : "indisponivel");
  const [email, setEmail] = useState("");

  const iniciar = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return setStep("conta");
    setEmail(s.session.user.email ?? "");
    const { data: me } = await sb.from("indicator_my_profile").select("completed").maybeSingle();
    setStep(me?.completed ? "empresas" : "cadastro");
  }, []);
  useEffect(() => { if (hasSupabase) void Promise.resolve().then(iniciar); }, [iniciar]);

  if (step === "carregando") return <Card><p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} aria-hidden /> Abrindo…</p></Card>;
  if (step === "indisponivel") return <Card><p className="text-sm">Cadastro indisponível neste ambiente.</p></Card>;
  if (step === "conta") return (
    <ContaPasso destino="/cadastro" onEntrou={() => { setStep("carregando"); void iniciar(); }} topo={<>
      <p className="text-sm text-muted">Passo 1 de 3</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Indique empresas que você conhece e ganhe comissão</h1>
      <p className="mt-2 text-sm text-muted">Crie sua conta, complete o cadastro e escolha as empresas que quer indicar. Se uma empresa te mandou um convite, use o link dela.</p>
    </>} />
  );
  if (step === "cadastro") return (
    <FormCadastro token={null} email={email} botao="Salvar e escolher empresas" topo={<p className="text-sm text-muted">Passo 2 de 3</p>} onPronto={() => setStep("empresas")} />
  );
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">Passo 3 de 3</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Escolha as empresas que você quer indicar</h1>
        <p className="mt-1 text-sm text-muted">Algumas aprovam o seu pedido antes; outras liberam na hora. Você acompanha tudo em <Link href="/conta" className="text-brand underline">Minha conta</Link>.</p>
      </div>
      <Vitrine />
    </div>
  );
}
