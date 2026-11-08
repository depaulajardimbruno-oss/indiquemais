"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Trash2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Linha = { user_id: string | null; email: string; full_name: string | null; role: "admin" | "operador"; kind: "membro" | "convite"; token: string | null; expires_at: string | null };
const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btn = "inline-flex min-h-10 items-center gap-2 rounded-brand border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";
const PAPEL = { admin: "Administrador", operador: "Operador" };

/** Quem acessa o painel da empresa e convites pendentes. Usado no admin do Indiki+ e na própria empresa. */
export function Equipe({ companyId, companyName, canEdit, meuId }: { companyId: string; companyName: string; canEdit: boolean; meuId?: string }) {
  const origin = useOrigin();
  const [lista, setLista] = useState<Linha[] | null>(null);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"admin" | "operador">("admin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [novoConvite, setNovoConvite] = useState<{ email: string; token: string } | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().from("company_team").select("*").eq("company_id", companyId).order("kind").order("created_at");
    setLista((data ?? []) as Linha[]);
  }, [companyId]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  async function liberar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setNovoConvite(null);
    const alvo = email.trim().toLowerCase();
    const { data, error } = await supabaseBrowser().rpc("company_grant_access", { p_company: companyId, p_email: alvo, p_role: papel });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    const row = Array.isArray(data) ? data[0] : null;
    if (row?.status === "vinculado") setMsg({ ok: true, text: `${alvo} já tinha conta e agora acessa o painel da ${companyName}.` });
    else if (row?.token) setNovoConvite({ email: alvo, token: row.token });
    setEmail("");
    await carregar();
  }

  async function acao(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setMsg(null);
    const { error } = await fn();
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: ok });
    await carregar();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <h3 className="flex items-center gap-2 font-semibold"><UserPlus size={18} aria-hidden /> Liberar acesso ao painel da {companyName}</h3>
          <p className="mt-1 text-sm text-muted">Informe o e-mail da pessoa. Se ela já tiver conta, o acesso vale na hora. Se não, geramos um link para ela criar a conta com senha.</p>
          <form onSubmit={liberar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
            <label className="block text-sm font-medium">E-mail
              <input required type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="responsavel@empresa.com.br" />
            </label>
            <label className="block text-sm font-medium">Papel
              <select className={field} value={papel} onChange={(e) => setPapel(e.target.value as "admin" | "operador")}>
                <option value="admin">Administrador</option>
                <option value="operador">Operador</option>
              </select>
            </label>
            <button type="submit" disabled={busy} className="min-h-12 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{busy ? "Liberando…" : "Liberar acesso"}</button>
          </form>
          <p className="mt-2 text-xs text-muted">Administrador cadastra produtos, indicadores e edita os dados. Operador só consulta.</p>
        </Card>
      )}

      {novoConvite && <LinkConvite email={novoConvite.email} token={novoConvite.token} origin={origin} companyName={companyName} destaque />}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}

      <Card>
        <h3 className="font-semibold">Quem acessa</h3>
        {lista === null && <p role="status" className="mt-2 text-sm text-muted">Carregando…</p>}
        {lista?.length === 0 && <p className="mt-2 text-sm text-muted">Ninguém ainda. Libere o acesso do responsável acima.</p>}
        <ul className="mt-2 divide-y divide-line">
          {lista?.map((l) => (
            <li key={l.user_id ?? l.token ?? l.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.full_name && l.kind === "membro" ? l.full_name : l.email}</p>
                <p className="truncate text-sm text-muted">
                  {l.kind === "membro" ? l.email : `Convite pendente, vale até ${new Date(l.expires_at!).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {l.kind === "membro" && canEdit && l.user_id !== meuId ? (
                  <select aria-label={`Papel de ${l.email}`} value={l.role} className="rounded-brand border border-line bg-white px-2 py-2 text-sm"
                    onChange={(e) => acao(() => supabaseBrowser().rpc("company_set_member_role", { p_company: companyId, p_user: l.user_id, p_role: e.target.value }), "Papel atualizado.")}>
                    <option value="admin">Administrador</option><option value="operador">Operador</option>
                  </select>
                ) : <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">{PAPEL[l.role]}</span>}
                {l.kind === "convite" && canEdit && (
                  <button className={btn} onClick={() => setNovoConvite({ email: l.email, token: l.token! })}><MessageCircle size={16} aria-hidden /> Reenviar</button>
                )}
                {canEdit && l.user_id !== meuId && (
                  <button className={btn} aria-label={l.kind === "membro" ? `Remover acesso de ${l.email}` : `Cancelar convite de ${l.email}`}
                    onClick={() => {
                      if (!confirm(l.kind === "membro" ? `Remover o acesso de ${l.email} ao painel da ${companyName}?` : `Cancelar o convite de ${l.email}?`)) return;
                      void (l.kind === "membro"
                        ? acao(() => supabaseBrowser().rpc("company_revoke_access", { p_company: companyId, p_user: l.user_id }), "Acesso removido.")
                        : acao(() => supabaseBrowser().rpc("company_cancel_access_invite", { p_token: l.token }), "Convite cancelado."));
                    }}>
                    <Trash2 size={16} aria-hidden /> {l.kind === "membro" ? "Remover" : "Cancelar"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function LinkConvite({ email, token, origin, companyName, destaque }: { email: string; token: string; origin: string; companyName: string; destaque?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${origin}/acesso/${token}`;
  const texto = `Olá! Liberamos o seu acesso ao painel da ${companyName} no Indiki+, onde você cadastra os produtos e acompanha os indicadores. Crie a sua senha por este link, usando o e-mail ${email}: ${link}`;
  return (
    <Card className={destaque ? "border-2 border-accent" : ""}>
      <h3 className="font-semibold">Mande este link para {email}</h3>
      <p className="mt-1 text-sm text-muted">A pessoa ainda não tem conta. Pelo link ela cria a senha e já entra no painel da {companyName}. Vale por 14 dias e só funciona com esse e-mail.</p>
      <p className="mt-3 break-all rounded-brand bg-brand-soft p-3 font-mono text-xs">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={btn} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* o link fica visível */ } }}>
          {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
        </button>
        <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden /> WhatsApp</a>
        <a className={btn} href={`mailto:${email}?subject=${encodeURIComponent(`Seu acesso ao painel da ${companyName} no Indiki+`)}&body=${encodeURIComponent(texto)}`}><Mail size={16} aria-hidden /> E-mail</a>
      </div>
    </Card>
  );
}
