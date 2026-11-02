import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";

export type Brand = {
  name: string;
  tagline: string;
  logoUrl: string | null;
  primary: string;
  primaryFg: string;
  accent: string;
  surface: string;
  ink: string;
  radiusPx: number;
};

export const DEFAULT_BRAND: Brand = {
  name: "Indiki+",
  tagline: "Indique, acompanhe e ganhe.",
  logoUrl: null,
  primary: "#14385f",
  primaryFg: "#ffffff",
  accent: "#f7931e",
  surface: "#f8fafc",
  ink: "#10243e",
  radiusPx: 12,
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const safeHex = (v: unknown, fallback: string) =>
  typeof v === "string" && HEX.test(v) ? v : fallback;

type Row = {
  name?: string;
  tagline?: string;
  logo_url?: string | null;
  color_primary?: string;
  color_primary_fg?: string;
  color_accent?: string;
  color_surface?: string;
  color_ink?: string;
  radius_px?: number;
};

/** Lê a identidade da tabela brand_settings (Supabase). Sem variáveis de ambiente
 *  ou em caso de erro, usa a identidade padrão: o site nunca quebra por isso. */
export async function getBrand(): Promise<Brand> {
  "use cache";
  cacheLife("minutes"); // mudanças no banco aparecem em alguns minutos, sem novo deploy
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_BRAND;

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("brand_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle<Row>();
    if (error || !data) return DEFAULT_BRAND;

    return {
      name: data.name?.trim() || DEFAULT_BRAND.name,
      tagline: data.tagline?.trim() || DEFAULT_BRAND.tagline,
      logoUrl: data.logo_url || null,
      primary: safeHex(data.color_primary, DEFAULT_BRAND.primary),
      primaryFg: safeHex(data.color_primary_fg, DEFAULT_BRAND.primaryFg),
      accent: safeHex(data.color_accent, DEFAULT_BRAND.accent),
      surface: safeHex(data.color_surface, DEFAULT_BRAND.surface),
      ink: safeHex(data.color_ink, DEFAULT_BRAND.ink),
      radiusPx: Number.isFinite(data.radius_px)
        ? Math.min(Math.max(Number(data.radius_px), 0), 28)
        : DEFAULT_BRAND.radiusPx,
    };
  } catch {
    return DEFAULT_BRAND;
  }
}

export function brandCssVars(b: Brand): Record<string, string> {
  return {
    "--brand": b.primary,
    "--brand-fg": b.primaryFg,
    "--accent": b.accent,
    "--surface": b.surface,
    "--ink": b.ink,
    "--radius": `${b.radiusPx}px`,
  };
}
