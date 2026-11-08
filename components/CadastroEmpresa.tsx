"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";
import { UFS, maskPhone } from "@/lib/cadastro";

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const maskCnpj = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

/** Pedido público de cadastro de empresa. O Indiki+ analisa e libera o acesso do responsável. */
export function CadastroEmpresa() {
  const [f, setF] = useState({ name: "", legal: "", cnpj: "", contact: "", email: "", phone: "", city: "", uf: "", segment: "", message: "", consent: false });
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSupabase) return setErro("Cadastro indisponível neste ambiente.");
    if (!f.consent) return setErro("Autorize o contato para enviar o pedido.");
    setErro(""); setBusy(true);
    const { error } = await supabaseBrowser().rpc("submit_company_signup", {
      p_company_name: f.name, p_legal_name: f.legal, p_cnpj: f.cnpj, p_contact_name: f.contact, p_email: f.email, p_phone: f.phone,
      p_city: f.city, p_state: f.uf, p_segment: f.segment, p_message: f.message, p_consent: f.consent,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    setOk(true);
  }

  if (ok) return (
    <Card className="text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" size={44} aria-hidden />
      <h1 className="mt-3 text-2xl font-semibold">Pedido recebido</h1>
      <p className="mt-1 text-sm text-muted">A equipe do Indiki+ vai analisar os dados da {f.name}. Quando aprovarmos, {f.contact.split(" ")[0]} recebe no e-mail {f.email} o link para criar a senha e entrar no painel da empresa.</p>
    </Card>
  );

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastre sua empresa no Indiki+</h1>
        <p className="mt-1 text-sm text-muted">Seus clientes indicam amigos, você vende mais e só paga comissão sobre venda fechada. Envie os dados e entraremos em contato.</p>
      </div>
      <Card className="space-y-4">
        <h2 className="font-semibold">Empresa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Nome fantasia<input required className={field} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="block text-sm font-medium">CNPJ<input required inputMode="numeric" className={field} value={f.cnpj} onChange={(e) => set("cnpj", maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" /></label>
        </div>
        <label className="block text-sm font-medium">Razão social<input required className={field} value={f.legal} onChange={(e) => set("legal", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem_1fr]">
          <label className="block text-sm font-medium">Cidade<input className={field} value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
          <label className="block text-sm font-medium">UF
            <select className={field} value={f.uf} onChange={(e) => set("uf", e.target.value)}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
          <label className="block text-sm font-medium">Ramo<input className={field} value={f.segment} onChange={(e) => set("segment", e.target.value)} placeholder="Ex.: vidraçaria, energia solar" /></label>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-semibold">Responsável</h2>
        <label className="block text-sm font-medium">Nome completo<input required autoComplete="name" className={field} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">E-mail<input required type="email" autoComplete="email" className={field} value={f.email} onChange={(e) => set("email", e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-muted">Será o login do painel da empresa.</span></label>
          <label className="block text-sm font-medium">Telefone (WhatsApp)<input required type="tel" autoComplete="tel" className={field} value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></label>
        </div>
        <label className="block text-sm font-medium">Algo que devemos saber? (opcional)
          <textarea rows={3} maxLength={1000} className={field} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Quantos clientes, o que vende, como imagina o programa de indicação…" />
        </label>
      </Card>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>Autorizo o Indiki+ a entrar em contato pelos dados informados para analisar o cadastro.</span>
      </label>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-brand bg-brand px-5 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{busy ? "Enviando…" : "Enviar pedido de cadastro"}</button>
    </form>
  );
}
