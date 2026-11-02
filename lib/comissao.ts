// Regra de comissão. Espelha o banco (função calc_commission, migração 20261102000400).
//   comissão = fixo + (percentual × valor total do contrato), limitada ao teto, se houver.

export type CommissionRule = {
  fixedCents: number | null; // valor fixo, em centavos
  percentBps: number | null; // 200 = 2%
  capCents: number | null; // teto opcional, em centavos
};

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function calcCommission(rule: CommissionRule, contractCents: number): number {
  const raw = (rule.fixedCents ?? 0) + Math.round((contractCents * (rule.percentBps ?? 0)) / 10000);
  return rule.capCents != null ? Math.min(raw, rule.capCents) : raw;
}

/** "R$ 100,00 + 2% do contrato (teto R$ 800,00)" */
export function describeRule(rule: CommissionRule): string {
  const parts: string[] = [];
  if (rule.fixedCents) parts.push(rule.percentBps ? brl(rule.fixedCents) : `${brl(rule.fixedCents)} por venda`);
  if (rule.percentBps) parts.push(`${(rule.percentBps / 100).toLocaleString("pt-BR")}% do contrato`);
  const base = parts.join(" + ");
  return rule.capCents != null ? `${base} (teto ${brl(rule.capCents)})` : base;
}

/** Texto digitado ("1.234,56", "300", "R$ 300,00") para centavos. Devolve null se inválido. */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[^\d,.-]/g, "").trim();
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\.(?=\d{3}\b)/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Porcentagem digitada ("2", "2,5") para pontos-base (200, 250). */
export function parsePercentBps(text: string): number | null {
  const n = Number(text.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Mesmas travas do banco (company_save_offer). Devolve a mensagem de erro ou null. */
export function validateRule(rule: CommissionRule): string | null {
  const fixed = rule.fixedCents || null;
  const pct = rule.percentBps || null;
  if (!fixed && !pct) return "Defina a comissão: um valor fixo, uma porcentagem do contrato, ou os dois.";
  if (pct && pct > 5000) return "Porcentagem acima de 50% precisa ser validada com o Indiki+.";
  if (rule.capCents != null && rule.capCents <= 0) return "O teto precisa ser maior que zero.";
  if (rule.capCents != null && fixed && rule.capCents < fixed) return "O teto não pode ser menor que o valor fixo.";
  return null;
}
