// Dados FICTÍCIOS do protótipo. Empresa piloto: Soulglass (apenas o nome; valores,
// pessoas e vendas abaixo são inventados e não representam a empresa real).

export type CommissionStatus = "pendente" | "liberada" | "paga" | "contestada";

import type { CommissionRule } from "@/lib/comissao";

export type Offer = {
  id: string;
  name: string;
  description: string;
  rule: CommissionRule;
  graceDays: number;
  active: boolean;
  referrals: number;
  sales: number;
  /** Versões da regra, da mais nova para a mais antiga. "open" = indicações em andamento que seguem aquela versão. */
  history: { version: number; rule: CommissionRule; graceDays: number; from: string; open: number }[];
};

export type Sale = {
  id: string;
  date: string; // ISO
  offerId: string;
  referrer: string;
  buyer: string; // já mascarado
  valueCents: number;
  source: "api" | "manual";
};

export type Commission = {
  id: string;
  saleId: string;
  offerName: string;
  referrer: string;
  pixKey: string;
  amountCents: number;
  status: CommissionStatus;
  releaseDate: string; // ISO
};

export const PILOT_COMPANY = "Soulglass";

export const offers: Offer[] = [
  {
    id: "o1",
    name: "Envidraçamento de sacada",
    description:
      "Cortina de vidro para fechar a sacada do apartamento, com medição e instalação inclusas.",
    rule: { fixedCents: 30000, percentBps: null, capCents: null },
    graceDays: 30,
    active: true,
    referrals: 64,
    sales: 6,
    history: [{ version: 2, rule: { fixedCents: 30000, percentBps: null, capCents: null }, graceDays: 30, from: "2026-09-15", open: 4 }, { version: 1, rule: { fixedCents: 25000, percentBps: null, capCents: null }, graceDays: 30, from: "2026-03-02", open: 1 }],
  },
  {
    id: "o2",
    name: "Box de banheiro",
    description: "Box em vidro temperado sob medida, com instalação.",
    rule: { fixedCents: 10000, percentBps: null, capCents: null },
    graceDays: 15,
    active: true,
    referrals: 142,
    sales: 19,
    history: [{ version: 1, rule: { fixedCents: 10000, percentBps: null, capCents: null }, graceDays: 15, from: "2026-03-02", open: 7 }],
  },
  {
    id: "o3",
    name: "Guarda-corpo de vidro",
    description: "Guarda-corpo para escadas, sacadas e terraços, com instalação.",
    rule: { fixedCents: 10000, percentBps: 100, capCents: 60000 },
    graceDays: 30,
    active: true,
    referrals: 38,
    sales: 5,
    history: [{ version: 1, rule: { fixedCents: 10000, percentBps: 100, capCents: 60000 }, graceDays: 30, from: "2026-05-10", open: 3 }],
  },
  {
    id: "o4",
    name: "Campanha de verão (encerrada)",
    description: "Condição especial de box e espelhos, encerrada em março.",
    rule: { fixedCents: 10000, percentBps: null, capCents: null },
    graceDays: 15,
    active: false,
    referrals: 27,
    sales: 4,
    history: [{ version: 1, rule: { fixedCents: 10000, percentBps: null, capCents: null }, graceDays: 15, from: "2026-01-12", open: 0 }],
  },
];

export const sales: Sale[] = [
  { id: "v1", date: "2026-10-30", offerId: "o2", referrer: "Marina Souza", buyer: "C*** A.", valueCents: 280000, source: "manual" },
  { id: "v2", date: "2026-10-29", offerId: "o1", referrer: "Rafael Lima", buyer: "Cond. Ed. B***", valueCents: 1850000, source: "manual" },
  { id: "v3", date: "2026-10-27", offerId: "o3", referrer: "Marina Souza", buyer: "J*** P.", valueCents: 940000, source: "api" },
  { id: "v4", date: "2026-10-12", offerId: "o2", referrer: "Camila Ferraz", buyer: "T*** R.", valueCents: 310000, source: "api" },
  { id: "v5", date: "2026-09-28", offerId: "o1", referrer: "Diego Alves", buyer: "M*** S.", valueCents: 2200000, source: "manual" },
  { id: "v6", date: "2026-09-20", offerId: "o3", referrer: "Rafael Lima", buyer: "A*** B.", valueCents: 880000, source: "manual" },
  { id: "v7", date: "2026-09-10", offerId: "o1", referrer: "Camila Ferraz", buyer: "R*** M.", valueCents: 1650000, source: "api" },
  { id: "v8", date: "2026-09-05", offerId: "o2", referrer: "Diego Alves", buyer: "L*** F.", valueCents: 265000, source: "manual" },
];

export const commissions: Commission[] = [
  { id: "c1", saleId: "v1", offerName: "Box de banheiro", referrer: "Marina Souza", pixKey: "marina***@email.com", amountCents: 10000, status: "pendente", releaseDate: "2026-11-14" },
  { id: "c2", saleId: "v2", offerName: "Envidraçamento de sacada", referrer: "Rafael Lima", pixKey: "***.482.***-12", amountCents: 30000, status: "pendente", releaseDate: "2026-11-28" },
  { id: "c3", saleId: "v3", offerName: "Guarda-corpo de vidro", referrer: "Marina Souza", pixKey: "marina***@email.com", amountCents: 20000, status: "pendente", releaseDate: "2026-11-26" },
  { id: "c4", saleId: "v4", offerName: "Box de banheiro", referrer: "Camila Ferraz", pixKey: "(19) 9****-3321", amountCents: 10000, status: "liberada", releaseDate: "2026-10-27" },
  { id: "c5", saleId: "v5", offerName: "Envidraçamento de sacada", referrer: "Diego Alves", pixKey: "diego***@email.com", amountCents: 30000, status: "liberada", releaseDate: "2026-10-28" },
  { id: "c6", saleId: "v6", offerName: "Guarda-corpo de vidro", referrer: "Rafael Lima", pixKey: "***.482.***-12", amountCents: 20000, status: "contestada", releaseDate: "2026-10-20" },
  { id: "c7", saleId: "v7", offerName: "Envidraçamento de sacada", referrer: "Camila Ferraz", pixKey: "(19) 9****-3321", amountCents: 30000, status: "paga", releaseDate: "2026-10-10" },
  { id: "c8", saleId: "v8", offerName: "Box de banheiro", referrer: "Diego Alves", pixKey: "diego***@email.com", amountCents: 10000, status: "paga", releaseDate: "2026-09-20" },
];

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const offerName = (id: string) => offers.find((o) => o.id === id)?.name ?? "—";
