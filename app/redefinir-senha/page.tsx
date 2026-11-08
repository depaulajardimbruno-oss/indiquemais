"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { MIN_PASSWORD, destinoAposEntrar, mensagemAuth, validarSenha } from "@/lib/auth";

const primary =
  "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";

/** Chega aqui pelo link "definir senha" do e-mail (o callback já abriu a sessão). */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "sem-sessao" | "form">(hasSupabase ? "carregando" : "sem-sessao");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!hasSupabase) return;
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (!data.session) return setEstado("sem-sessao");
      setEmail(data.session.user.email ?? "");
      setEstado("form");
    });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarSenha(senha, confirma);
    if (v) return setErro(v);
    setErro(""); setSalvando(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) { setSalvando(false); return setErro(mensagemAuth(error.message)); }
    router.replace(await destinoAposEntrar(sb));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-4">
      <Card>
        {estado === "carregando" && <p role="status" className="text-sm text-muted">Abrindo…</p>}
        {estado === "sem-sessao" && (
          <>
            <h1 className="text-xl font-semibold">Link vencido ou já usado</h1>
            <p className="mt-1 text-sm text-muted">Peça um novo link em &quot;Esqueci minha senha&quot;.</p>
            <Link href="/entrar" className={primary}>Voltar para entrar</Link>
          </>
        )}
        {estado === "form" && (
          <form onSubmit={salvar}>
            <h1 className="text-xl font-semibold">Defina a sua senha</h1>
            <p className="mt-1 text-sm text-muted">Conta de <strong>{email}</strong>.</p>
            <PasswordInput label="Nova senha" value={senha} onChange={setSenha} autoComplete="new-password" hint={`Pelo menos ${MIN_PASSWORD} caracteres, com letras e números.`} />
            <PasswordInput label="Repita a nova senha" value={confirma} onChange={setConfirma} autoComplete="new-password" />
            {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
            <button type="submit" disabled={salvando} className={primary}>{salvando ? "Salvando…" : "Salvar senha e entrar"}</button>
          </form>
        )}
      </Card>
    </main>
  );
}
