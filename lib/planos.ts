import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";

export type PlanoPublico = {
  code: string;
  nome: string;
  descricao: string | null;
  mesCentavos: number;
  meses: number;
  taxaBps: number;
};

/** Usado se o banco não responder: os mesmos valores da migração 1800. */
const PADRAO: PlanoPublico[] = [
  { code: "inicial", nome: "Mensal", descricao: "Sem fidelidade. Cancele quando quiser.", mesCentavos: 39700, meses: 1, taxaBps: 100 },
  { code: "intermediario", nome: "Semestral", descricao: "Fidelidade de 6 meses.", mesCentavos: 29700, meses: 6, taxaBps: 80 },
  { code: "avancado", nome: "Anual", descricao: "Fidelidade de 12 meses. O melhor preço.", mesCentavos: 19700, meses: 12, taxaBps: 60 },
];

type Row = {
  code: string;
  name: string;
  description: string | null;
  monthly_price_cents: number | null;
  commitment_months: number | null;
  platform_fee_bps: number;
};

/** Planos ativos e com preço, na ordem do banco. Mudou no banco, aparece no site em minutos. */
export async function getPlanos(): Promise<PlanoPublico[]> {
  "use cache";
  cacheLife("minutes");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return PADRAO;
  try {
    const { data, error } = await createClient(url, key)
      .from("plans")
      .select("code,name,description,monthly_price_cents,commitment_months,platform_fee_bps")
      .eq("active", true)
      .not("monthly_price_cents", "is", null)
      .order("sort_order");
    if (error || !data?.length) return PADRAO;
    return (data as Row[]).map((r) => ({
      code: r.code,
      nome: r.name,
      descricao: r.description,
      mesCentavos: r.monthly_price_cents ?? 0,
      meses: r.commitment_months ?? 1,
      taxaBps: r.platform_fee_bps,
    }));
  } catch {
    return PADRAO;
  }
}

export const pct = (bps: number) =>
  (bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
