"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, MessageCircle, Pause, Play, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui";
import { useOrigin } from "@/components/useOrigin";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Invite = { token: string; active: boolean; joined: number };

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-brand border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";

/** Link de convite da empresa: copiar, mandar por WhatsApp, pausar e renovar. */
export function ConviteCard({ companyId, companyName, canEdit, onToken }: { companyId: string; companyName: string; canEdit: boolean; onToken?: (token: string | null) => void }) {
  const origin = useOrigin();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser().rpc("company_invite_get", { p_company: companyId });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) { setMsg("Não foi possível abrir o link desta empresa."); onToken?.(null); return; }
    setInvite({ token: row.token, active: row.active, joined: Number(row.joined) });
    onToken?.(row.active ? row.token : null);
  }, [companyId, onToken]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const link = invite ? `${origin}/convite/${invite.token}` : "";
  const text = `Olá! A ${companyName} agora tem um programa de indicação pelo Indiki+: você indica amigos e ganha comissão por PIX quando eles fecham. Cadastre-se por aqui: ${link}`;

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true); setMsg("");
    const { error } = await fn();
    if (error) setMsg(error.message); else { await load(); setMsg(ok); }
    setBusy(false);
  }

  return (
    <Card className="border-2 border-accent">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Link2 size={18} aria-hidden /> Link de convite para novos indicadores</h2>
          <p className="text-sm text-muted">Mande para os seus clientes. Quem abrir faz o cadastro completo e já fica vinculado à {companyName}.</p>
        </div>
      </div>

      {invite && (
        <>
          <p className={`mt-4 break-all rounded-brand bg-brand-soft p-3 font-mono text-xs ${invite.active ? "" : "line-through opacity-60"}`}>{link}</p>
          <p className="mt-1 text-xs text-muted">{invite.active ? "Link ativo." : "Link pausado: ninguém consegue se cadastrar por ele."} {invite.joined} {invite.joined === 1 ? "cadastro feito" : "cadastros feitos"} por convite.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn} disabled={!invite.active} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* o link continua visível */ } }}>
              <Copy size={16} aria-hidden /> {copied ? "Copiado" : "Copiar link"}
            </button>
            <a className={`${btn} ${invite.active ? "" : "pointer-events-none opacity-60"}`} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden /> Enviar por WhatsApp
            </a>
            {canEdit && <button className={btn} disabled={busy} onClick={() => run(() => supabaseBrowser().rpc("company_invite_set_active", { p_company: companyId, p_active: !invite.active }), invite.active ? "Link pausado." : "Link reativado.")}>
              {invite.active ? <><Pause size={16} aria-hidden /> Pausar</> : <><Play size={16} aria-hidden /> Reativar</>}
            </button>}
            {canEdit && <button className={btn} disabled={busy} onClick={() => { if (confirm("Renovar o link? O link atual deixa de funcionar na hora. Quem já se cadastrou continua vinculado.")) void run(() => supabaseBrowser().rpc("company_invite_rotate", { p_company: companyId }), "Link renovado. O anterior não funciona mais."); }}>
              <RefreshCw size={16} aria-hidden /> Renovar link
            </button>}
          </div>
        </>
      )}
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    </Card>
  );
}
