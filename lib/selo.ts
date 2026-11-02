// Aparência do selo por nível. Cores escolhidas para se distinguirem entre si e para o texto ter contraste.
export type SealStyle = { from: string; to: string; ring: string; text: string };
export const SEAL_STYLE: Record<string, SealStyle> = {
  bronze:   { from: "#d9955a", to: "#9c5a2b", ring: "#6f3d1a", text: "#ffffff" },
  prata:    { from: "#eef1f5", to: "#a7b0bc", ring: "#6b7685", text: "#1f2937" },
  ouro:     { from: "#ffd45c", to: "#d89a14", ring: "#8a5d06", text: "#3d2800" },
  platina:  { from: "#cfe7ef", to: "#6fa3b5", ring: "#2f6477", text: "#0f2f3a" },
  diamante: { from: "#bff0ff", to: "#4ea8f0", ring: "#1c5aa8", text: "#06264d" },
};
export const styleFor = (code: string): SealStyle => SEAL_STYLE[code] ?? SEAL_STYLE.bronze;

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** O selo como texto SVG. É a única fonte do desenho: a tela e a imagem do site da empresa usam o mesmo. */
export function sealSvg(level: string, label: string, size = 120, id = "s", standalone = false): string {
  const s = styleFor(level);
  const g = `${id}-${level}`;
  const l = esc(label);
  return `<svg ${standalone ? 'xmlns="http://www.w3.org/2000/svg" ' : ""}width="${size}" height="${Math.round(size * 1.15)}" viewBox="0 0 120 138" role="img" aria-label="Selo Indiki+ ${l}">`
    + `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.from}"/><stop offset="1" stop-color="${s.to}"/></linearGradient></defs>`
    + `<path d="M60 4 112 22v44c0 32-22 56-52 68C30 122 8 98 8 66V22Z" fill="url(#${g})" stroke="${s.ring}" stroke-width="4" stroke-linejoin="round"/>`
    + `<path d="M60 14 102 28v38c0 25-17 45-42 56C35 111 18 91 18 66V28Z" fill="none" stroke="${s.ring}" stroke-opacity=".35" stroke-width="2"/>`
    + `<text x="60" y="52" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-weight="800" font-size="22" fill="${s.text}">Indiki+</text>`
    + `<line x1="30" y1="62" x2="90" y2="62" stroke="${s.ring}" stroke-opacity=".5" stroke-width="1.5"/>`
    + `<text x="60" y="88" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-weight="700" font-size="19" fill="${s.text}">${l}</text>`
    + `<text x="60" y="104" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7.5" letter-spacing=".3" fill="${s.text}" fill-opacity=".8">EMPRESA VERIFICADA</text></svg>`;
}
