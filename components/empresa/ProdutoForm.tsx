"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { brl, calcCommission, describeRule, parseMoney, parsePercentBps, validateRule } from "@/lib/comissao";
import { useEmpresa } from "@/components/empresa/EmpresaContext";
import { regraDe, type ProdutoRow } from "@/components/empresa/Produtos";

const field = "mt-1 w-full rounded-brand border border-line bg-white px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";
type Mode = "fixed" | "percent" | "mixed";
const MODES: [Mode, string][] = [["fixed", "Valor fixo"], ["percent", "% do contrato"], ["mixed", "Fixo + %"]];
const toText = (c: number) => (c / 100).toFixed(2).replace(".", ",");
type Versao = { version: number; fixed_cents: number | null; percent_bps: number | null; cap_cents: number | null; grace_days: number; valid_from: string; referrals_count: number; open_count: number };

export function ProdutoForm({ id }: { id?: string }) {
  const { empresa } = useEmpresa();
  const [prod, setProd] = useState<ProdutoRow | null | undefined>(id ? undefined : null);
  const [versoes, setVersoes] = useState<Versao[]>([]);

  useEffect(() => {
    if (!id) return;
    const sb = supabaseBrowser();
    let vivo = true;
    (async () => {
      const [{ data: p }, { data: h }] = await Promise.all([
        sb.from("company_offers").select("*").eq("id", id).eq("company_id", empresa.id).maybeSingle(),
        sb.from("company_offer_rule_history").select("version, fixed_cents, percent_bps, cap_cents, grace_days, valid_from, referrals_count, open_count:open_referrals_count").eq("offer_id", id).order("version", { ascending: false }),
      ]);
      if (!vivo) return;
      setProd((p as ProdutoRow) ?? null);
      setVersoes((h ?? []) as Versao[]);
    })();
    return () => { vivo = false; };
  }, [id, empresa.id]);

  if (!empresa.can_edit) return <Card><p className="text-sm">Só o administrador da empresa cadastra e edita produtos.</p></Card>;
  if (prod === undefined) return <p role="status" className="text-sm text-muted">Carregando…</p>;
  if (id && prod === null) return <Card><p className="text-sm">Produto não encontrado. <Link href="/empresa/produtos" className="text-brand underline">Voltar</Link></p></Card>;
  return <Form key={prod?.id ?? "novo"} prod={prod} versoes={versoes} />;
}

function Form({ prod, versoes }: { prod: ProdutoRow | null; versoes: Versao[] }) {
  const router = useRouter();
  const { empresa } = useEmpresa();
  const r0 = prod ? regraDe(prod) : null;
  const [name, setName] = useState(prod?.name ?? "");
  const [desc, setDesc] = useState(prod?.description ?? "");
  const [mode, setMode] = useState<Mode>(!r0 ? "percent" : r0.fixedCents && r0.percentBps ? "mixed" : r0.fixedCents ? "fixed" : "percent");
  const [fixed, setFixed] = useState(r0?.fixedCents ? toText(r0.fixedCents) : "");
  const [percent, setPercent] = useState(r0?.percentBps ? String(r0.percentBps / 100).replace(".", ",") : "");
  const [hasCap, setHasCap] = useState(r0?.capCents != null);
  const [cap, setCap] = useState(r0?.capCents != null ? toText(r0.capCents) : "");
  const [grace, setGrace] = useState(String(prod?.grace_days ?? 30));
  const [active, setActive] = useState(prod?.active ?? true);
  const [example, setExample] = useState("15.000,00");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const rule = {
    fixedCents: mode !== "percent" ? parseMoney(fixed) : null,
    percentBps: mode !== "fixed" ? parsePercentBps(percent) : null,
    capCents: hasCap ? parseMoney(cap) : null,
  };
  const graceN = Number(grace);
  const valid = validateRule(rule) === null;
  const exampleCents = parseMoney(example);
  const mudouRegra = Boolean(r0) && (rule.fixedCents !== r0!.fixedCents || rule.percentBps !== r0!.percentBps || rule.capCents !== r0!.capCents || graceN !== prod!.grace_days);
  const abertas = prod?.open_count ?? 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = validateRule(rule);
    if (v) return setErro(v);
    if (!Number.isInteger(graceN) || graceN < 0) return setErro("Carência inválida: use um número de dias.");
    setErro(""); setSalvando(true);
    const { error } = await supabaseBrowser().rpc("company_save_offer", {
      p_company: empresa.id, p_offer: prod?.id ?? null, p_name: name, p_description: desc || null,
      p_fixed_cents: rule.fixedCents, p_percent_bps: rule.percentBps, p_cap_cents: rule.capCents, p_grace_days: graceN, p_active: active,
    });
    setSalvando(false);
    if (error) return setErro(/limite|plano/i.test(error.message) ? `${error.message} Para cadastrar mais, fale com o Indiki+ sobre mudar de plano.` : error.message);
    router.push("/empresa/produtos");
  }

  return (
    <>
      <PageHeader title={prod ? `Editar: ${prod.name}` : "Novo produto"} subtitle={prod ? "Mudar a comissão vale só para indicações criadas depois de salvar." : "Defina o que será indicado e como a comissão é calculada."} />
      <form onSubmit={salvar} className="max-w-2xl space-y-5">
        <Card className="space-y-4">
          <label className="block text-sm font-medium">Nome do produto
            <input required className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Box de banheiro" />
          </label>
          <label className="block text-sm font-medium">Descrição para o indicador
            <textarea rows={3} className={field} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="O que é e para quem serve. Ex.: box sob medida, com instalação." />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Produto ativo (aparece para os indicadores)
          </label>
        </Card>

        <Card className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium">Como calcular a comissão</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {MODES.map(([v, label]) => (
                <label key={v} className={`cursor-pointer rounded-brand border px-3 py-2 text-center text-sm ${mode === v ? "border-brand bg-brand-soft font-medium" : "border-line"}`}>
                  <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />{label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mode !== "percent" && (
              <label className="block text-sm font-medium">Valor fixo por venda (R$)
                <input inputMode="decimal" className={field} value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="100,00" />
              </label>
            )}
            {mode !== "fixed" && (
              <label className="block text-sm font-medium">Porcentagem do contrato (%)
                <input inputMode="decimal" className={field} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="2" />
              </label>
            )}
            <label className="block text-sm font-medium">Carência antes de liberar (dias)
              <input required inputMode="numeric" className={field} value={grace} onChange={(e) => setGrace(e.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={hasCap} onChange={(e) => setHasCap(e.target.checked)} /> Definir um teto de comissão (opcional)
            </label>
            {hasCap && (
              <label className="mt-2 block text-sm font-medium">Teto por venda (R$)
                <input inputMode="decimal" className={field} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="800,00" />
              </label>
            )}
          </div>
          <div className="rounded-brand bg-brand-soft p-3 text-sm">
            <label className="block font-medium">Simule: contrato de R$
              <input inputMode="decimal" value={example} onChange={(e) => setExample(e.target.value)} className={`${field} max-w-44`} />
            </label>
            <p className="mt-2" aria-live="polite">
              {valid && exampleCents != null
                ? <>O indicador recebe <strong>{brl(calcCommission(rule, exampleCents))}</strong>{rule.capCents != null && calcCommission({ ...rule, capCents: null }, exampleCents) > rule.capCents ? " (limitado pelo teto)" : ""}.</>
                : "Preencha a regra para ver o resultado."}
            </p>
          </div>
          <p className="text-xs text-muted">A porcentagem incide sobre o valor total do contrato. A comissão é liberada depois da instalação e do prazo de carência, para cobrir cancelamentos.</p>
        </Card>

        {prod && (
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold">Como fica depois de salvar</h2>
            {mudouRegra ? (
              <p role="status" className="rounded-brand bg-amber-50 p-3 text-sm text-amber-900">
                {abertas > 0 ? `${abertas} ${abertas === 1 ? "indicação em andamento continua" : "indicações em andamento continuam"} com a regra de quando ${abertas === 1 ? "foi criada" : "foram criadas"}. ` : ""}
                Só as indicações novas usam <strong>{valid ? describeRule(rule) : "a nova regra"}</strong>. Quem já indicou recebe o que viu na hora de indicar.
              </p>
            ) : <p className="text-sm text-muted">Você não mudou a regra de comissão. Nome, descrição e situação podem mudar quando quiser.</p>}
            {versoes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">Histórico da regra</h3>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {versoes.map((v, i) => (
                    <li key={v.version} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span><strong>{describeRule({ fixedCents: v.fixed_cents, percentBps: v.percent_bps, capCents: v.cap_cents })}</strong>, carência {v.grace_days} dias{i === 0 ? " (vale hoje)" : ""}</span>
                      <span className="text-muted">desde {new Date(v.valid_from).toLocaleDateString("pt-BR")} · {v.referrals_count} indicações</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={salvando} className="min-h-11 rounded-brand bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">{salvando ? "Salvando…" : prod ? "Salvar alterações" : "Salvar produto"}</button>
          <Link href="/empresa/produtos" className="inline-flex min-h-11 items-center rounded-brand border border-line px-5 py-2 text-sm">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
