// Dados FICTÍCIOS do protótipo: cadastro de indicadores pela empresa.
// As regras abaixo espelham o banco (migração 20261102000300_indicator_registry.sql).

export type Indicator = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  code: string;
  hasAccount: boolean;
  active: boolean;
  referrals: number;
};

export type AccessRequest = {
  id: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  state: "pendente" | "recusado";
};

export const initialIndicators: Indicator[] = [
  { id: "i1", name: "Marina Souza", email: "marina@email.com", phone: "(19) 90000-1234", code: "MARINA7K", hasAccount: true, active: true, referrals: 7 },
  { id: "i2", name: "Rafael Lima", email: "rafael@email.com", phone: "(19) 91111-2222", code: "RAFAEL3Q", hasAccount: true, active: true, referrals: 4 },
  { id: "i3", name: "Camila Ferraz", email: null, phone: "(19) 92222-3321", code: "CAMILA-9HX2", hasAccount: false, active: true, referrals: 0 },
];

export const initialRequests: AccessRequest[] = [
  { id: "p1", name: "Diego Alves", email: "diego@email.com", phone: "(19) 93333-4455", note: "Cliente desde setembro (sacada)", state: "pendente" },
  { id: "p2", name: "Patrícia Gomes", email: "patricia@email.com", phone: "(19) 94444-5566", note: "Fechou box de banheiro", state: "pendente" },
];

/** Só dígitos, últimos 11 (igual ao banco). Devolve null se não parecer telefone com DDD. */
export function normPhone(p: string): string | null {
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-11) : null;
}

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I

/** Código curto e legível, ex.: PEDRO-H5YG (igual ao banco). */
export function genCode(name: string, taken: string[]): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const base =
    first.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "AMIGO";
  for (let i = 0; i < 50; i++) {
    let s = "";
    for (let k = 0; k < 4; k++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
    const code = `${base.length < 2 ? "AMIGO" : base}-${s}`;
    if (!taken.includes(code)) return code;
  }
  return `${base}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}
