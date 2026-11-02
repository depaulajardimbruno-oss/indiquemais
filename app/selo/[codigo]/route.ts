import { sealSvg } from "@/lib/selo";
import { certByCode, levelName } from "@/lib/plataforma";

/** Imagem do selo, para a empresa colocar no site dela. Só mostra o selo se o certificado é válido. */
export async function GET(_req: Request, ctx: RouteContext<"/selo/[codigo]">) {
  const { codigo } = await ctx.params;
  const cert = certByCode(decodeURIComponent(codigo));
  const valid = cert?.status === "valido";
  const svg = valid
    ? sealSvg(cert!.level, levelName(cert!.level), 120, "img", true)
    : `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="138" viewBox="0 0 120 138" role="img" aria-label="Selo Indiki+ indisponível"><path d="M60 4 112 22v44c0 32-22 56-52 68C30 122 8 98 8 66V22Z" fill="#e5e7eb" stroke="#9ca3af" stroke-width="4"/><text x="60" y="70" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#6b7280">Selo</text><text x="60" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#6b7280">indisponível</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
