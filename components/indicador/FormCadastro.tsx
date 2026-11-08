"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { PIX_TYPES, TERMS_VERSION, UFS, maskCpf, maskPhone, maxBirthDate, onlyDigits, validCpf, type PixType } from "@/lib/cadastro";

const field =
  "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
const btn =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60";

/** Cadastro completo do indicador (perfil, CPF, PIX, termos). Com token, também vincula à empresa do convite. */
export function FormCadastro({ token, email, topo, botao, onPronto }: {
  token: string | null; email: string; topo: React.ReactNode; botao: string; onPronto: (code: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [cpfSalvo, setCpfSalvo] = useState(false);
  const [f, setF] = useState({
    name: "", phone: "", birth: "", city: "", uf: "SP", cpf: "",
    pixType: "cpf" as PixType, pixKey: "", kind: "cliente", terms: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Já tem cadastro? Pré-preenche e deixa só confirmar.
  useEffect(() => {
    supabaseBrowser().from("indicator_my_profile").select("*").maybeSingle().then(({ data: me }) => {
      if (!me?.completed) return;
      setCpfSalvo(Boolean(me.cpf_masked));
      setF((p) => ({
        ...p, name: me.full_name ?? "", phone: me.phone ?? "", birth: me.birth_date ?? "", city: me.city ?? "", uf: me.state ?? "SP",
        cpf: me.cpf_masked ?? "", pixType: (me.pix_key_type ?? "cpf") as PixType, pixKey: me.pix_key ?? "", kind: me.profile_kind ?? "cliente",
      }));
    });
  }, []);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (f.name.trim().split(/\s+/).length < 2) return setErro("Informe o nome completo, como está no documento.");
    if (onlyDigits(f.phone).length < 10) return setErro("Informe o telefone com DDD.");
    if (!f.birth || f.birth > maxBirthDate(new Date())) return setErro("Para receber comissões é preciso ter 18 anos ou mais.");
    if (!cpfSalvo && !validCpf(f.cpf)) return setErro("CPF inválido. Confira os números.");
    if (!f.pixKey.trim()) return setErro("Informe a chave PIX para receber.");
    if (!f.terms) return setErro("Aceite os termos para continuar.");
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("indicator_register", {
      p_token: token, p_full_name: f.name, p_phone: f.phone, p_birth_date: f.birth, p_city: f.city, p_state: f.uf,
      p_cpf: cpfSalvo ? "" : f.cpf, p_pix_type: f.pixType, p_pix_key: f.pixKey, p_profile_kind: f.kind,
      p_terms_version: TERMS_VERSION, p_accept_terms: f.terms,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    onPronto(data ? String(data) : null);
  }

  return (
    <Card>
      {topo}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Complete o seu cadastro</h1>
      <p className="mt-2 text-sm text-muted">Precisamos destes dados para pagar suas comissões e emitir o informe de rendimentos. Conta de <strong>{email}</strong>.</p>
      <form onSubmit={cadastrar} className="mt-4 space-y-4" noValidate>
        <label className="block text-sm font-medium">Nome completo
          <input required autoComplete="name" className={field} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Como está no seu documento" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">CPF
            <input required inputMode="numeric" autoComplete="off" className={field} value={f.cpf} readOnly={cpfSalvo} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
            {cpfSalvo && <span className="mt-1 block text-xs font-normal text-muted">Já cadastrado. Para trocar, fale com o suporte.</span>}
          </label>
          <label className="block text-sm font-medium">Data de nascimento
            <input required type="date" autoComplete="bday" className={field} value={f.birth} max={maxBirthDate(new Date())} onChange={(e) => set("birth", e.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-medium">Telefone (WhatsApp)
          <input required type="tel" autoComplete="tel" className={field} value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-4">
          <label className="block text-sm font-medium">Cidade
            <input required autoComplete="address-level2" className={field} value={f.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label className="block text-sm font-medium">UF
            <select className={field} value={f.uf} onChange={(e) => set("uf", e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Você é</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[["cliente", "Cliente da empresa"], ["profissional", "Profissional (arquiteto, engenheiro…)"]].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-brand border px-3 py-2 text-center text-sm ${f.kind === v ? "border-brand bg-brand-soft font-medium" : "border-line"}`}>
                <input type="radio" name="kind" value={v} checked={f.kind === v} onChange={() => set("kind", v)} className="sr-only" />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <label className="block text-sm font-medium">Tipo da chave PIX
            <select className={field} value={f.pixType} onChange={(e) => set("pixType", e.target.value as PixType)}>
              {PIX_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Chave PIX para receber
            <input required className={field} value={f.pixKey} onChange={(e) => set("pixKey", e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-muted">{PIX_TYPES.find((p) => p.value === f.pixType)?.hint}</span>
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} />
          <span>Li e aceito os <Link href="/termos" target="_blank" className="font-medium text-brand underline">termos de uso e o tratamento dos meus dados</Link>.</span>
        </label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <button type="submit" disabled={busy} className={btn}>{busy ? "Salvando…" : botao}</button>
      </form>
    </Card>
  );
}
