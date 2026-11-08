"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { Card } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEmpresa } from "@/components/empresa/EmpresaContext";

const MODOS = [
  ["aprovacao", "Com aprovação", "Aparece no site do Indiki+. Quem pedir para indicar fica aguardando você aceitar."],
  ["aberto", "Aberta", "Aparece no site e quem pedir já vira indicador na hora."],
  ["fechado", "Só por convite", "Não aparece no site. Indicadores entram só pelo seu link de convite ou cadastro manual."],
] as const;

/** Como a empresa aparece para quem quer indicar pelo site. */
export function VitrineCard() {
  const { empresa, recarregar } = useEmpresa();
  const [modo, setModo] = useState(empresa.listing_mode ?? "aprovacao");
  const [desc, setDesc] = useState(empresa.public_description ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const mudou = modo !== (empresa.listing_mode ?? "aprovacao") || desc !== (empresa.public_description ?? "");

  async function salvar() {
    setBusy(true); setMsg(null);
    const { error } = await supabaseBrowser().rpc("company_set_listing", { p_company: empresa.id, p_mode: modo, p_description: desc });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    await recarregar();
    setMsg({ ok: true, text: "Salvo." });
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Store size={18} aria-hidden /> Novos indicadores pelo site do Indiki+</h2>
      <fieldset className="mt-3" disabled={!empresa.can_edit}>
        <legend className="sr-only">Como a empresa aparece</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODOS.map(([v, t, d]) => (
            <label key={v} className={`cursor-pointer rounded-brand border p-3 text-sm ${modo === v ? "border-brand bg-brand-soft" : "border-line"}`}>
              <span className="flex items-center gap-2 font-medium"><input type="radio" name="modo" value={v} checked={modo === v} onChange={() => setModo(v)} /> {t}</span>
              <span className="mt-1 block text-xs text-muted">{d}</span>
            </label>
          ))}
        </div>
        {modo !== "fechado" && (
          <label className="mt-3 block text-sm font-medium">Frase que aparece no site (opcional)
            <input maxLength={400} className="mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Vidros temperados e envidraçamento em Campinas e região" />
          </label>
        )}
      </fieldset>
      {empresa.can_edit && (
        <div className="mt-3 flex items-center gap-3">
          <button onClick={salvar} disabled={!mudou || busy} className="min-h-11 rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-50">{busy ? "Salvando…" : "Salvar"}</button>
          {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
        </div>
      )}
    </Card>
  );
}
