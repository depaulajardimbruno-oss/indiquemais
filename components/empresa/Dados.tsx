"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { UFS, maskPhone } from "@/lib/cadastro";
import { useEmpresa, type Empresa } from "@/components/empresa/EmpresaContext";

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line disabled:bg-surface disabled:text-muted";

const maskCep = (s: string) => s.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const maskCnpj = (s: string | null) => (s ?? "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function inicial(e: Empresa) {
  return {
    name: e.name ?? "", phone: e.phone ?? "", email: e.email ?? "", finance: e.finance_email ?? "", website: e.website ?? "",
    zip: maskCep(e.address_zip ?? ""), street: e.address_street ?? "", number: e.address_number ?? "", complement: e.address_complement ?? "",
    district: e.address_district ?? "", city: e.address_city ?? "", uf: e.address_state ?? "",
  };
}

export function Dados() {
  const { empresa } = useEmpresa();
  return <Formulario key={empresa.id} />;
}

function Formulario() {
  const { empresa, recarregar } = useEmpresa();
  const [f, setF] = useState(() => inicial(empresa));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setMsg(null); };
  const ro = !empresa.can_edit;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setMsg(null);
    const { error } = await supabaseBrowser().rpc("company_update_profile", {
      p_company: empresa.id, p_name: f.name, p_phone: f.phone, p_email: f.email, p_finance_email: f.finance, p_website: f.website,
      p_zip: f.zip, p_street: f.street, p_number: f.number, p_complement: f.complement, p_district: f.district, p_city: f.city, p_state: f.uf,
    });
    setSalvando(false);
    if (error) return setMsg({ ok: false, text: error.message });
    await recarregar();
    setMsg({ ok: true, text: "Dados salvos." });
  }

  return (
    <>
      <PageHeader title="Dados da empresa" subtitle={ro ? "Só o administrador da empresa pode alterar estes dados." : "Estes dados aparecem nas faturas e nos recibos do Indiki+."} />
      <form onSubmit={salvar} className="max-w-3xl space-y-5">
        <Card className="space-y-4">
          <h2 className="font-semibold">Identificação</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Razão social
              <input className={field} value={empresa.legal_name ?? ""} disabled />
            </label>
            <label className="block text-sm font-medium">CNPJ
              <input className={field} value={maskCnpj(empresa.cnpj)} disabled />
            </label>
          </div>
          <p className="text-xs text-muted">Razão social e CNPJ são a base das faturas. Para corrigir, fale com o Indiki+.</p>
          <label className="block text-sm font-medium">Nome que aparece para os indicadores
            <input required className={field} value={f.name} disabled={ro} onChange={(e) => set("name", e.target.value)} />
          </label>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Contato</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Telefone
              <input type="tel" className={field} value={f.phone} disabled={ro} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(00) 0000-0000" />
            </label>
            <label className="block text-sm font-medium">E-mail de contato
              <input type="email" className={field} value={f.email} disabled={ro} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="block text-sm font-medium">E-mail financeiro
              <input required type="email" className={field} value={f.finance} disabled={ro} onChange={(e) => set("finance", e.target.value)} />
              <span className="mt-1 block text-xs font-normal text-muted">Recebe as faturas e os recibos.</span>
            </label>
            <label className="block text-sm font-medium">Site
              <input className={field} value={f.website} disabled={ro} onChange={(e) => set("website", e.target.value)} placeholder="www.suaempresa.com.br" />
            </label>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Endereço</h2>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr_7rem]">
            <label className="block text-sm font-medium">CEP
              <input inputMode="numeric" className={field} value={f.zip} disabled={ro} onChange={(e) => set("zip", maskCep(e.target.value))} placeholder="00000-000" />
            </label>
            <label className="block text-sm font-medium">Rua
              <input className={field} value={f.street} disabled={ro} onChange={(e) => set("street", e.target.value)} />
            </label>
            <label className="block text-sm font-medium">Número
              <input className={field} value={f.number} disabled={ro} onChange={(e) => set("number", e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Complemento
              <input className={field} value={f.complement} disabled={ro} onChange={(e) => set("complement", e.target.value)} />
            </label>
            <label className="block text-sm font-medium">Bairro
              <input className={field} value={f.district} disabled={ro} onChange={(e) => set("district", e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <label className="block text-sm font-medium">Cidade
              <input className={field} value={f.city} disabled={ro} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label className="block text-sm font-medium">UF
              <select className={field} value={f.uf} disabled={ro} onChange={(e) => set("uf", e.target.value)}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
          </div>
        </Card>

        {!ro && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={salvando} className="min-h-11 rounded-brand bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{salvando ? "Salvando…" : "Salvar dados"}</button>
            {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
          </div>
        )}
      </form>
    </>
  );
}
