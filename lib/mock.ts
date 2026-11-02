// Dados de exemplo do protótipo. Não são dados reais.

export type CommissionStatus = "pendente" | "liberada" | "paga" | "contestada";

export type Offer = {
  id: string;
  name: string;
  description: string;
  commissionLabel: string;
  graceDays: number;
  active: boolean;
  referrals: number;
  sales: number;
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

export const offers: Offer[] = [
  {
    id: "o1",
    name: "Plano Anual Premium",
    description: "Assinatura anual com 2 meses grátis para novos clientes.",
    commissionLabel: "10% da venda",
    graceDays: 15,
    active: true,
    referrals: 148,
    sales: 31,
  },
  {
    id: "o2",
    name: "Consultoria de Implantação",
    description: "Pacote de 20h para implantar o sistema na sua empresa.",
    commissionLabel: "R$ 300,00 fixo",
    graceDays: 30,
    active: true,
    referrals: 52,
    sales: 9,
  },
  {
    id: "o3",
    name: "Curso Online Essencial",
    description: "Acesso vitalício ao curso com certificado.",
    commissionLabel: "20% da venda",
    graceDays: 7,
    active: true,
    referrals: 311,
    sales: 87,
  },
  {
    id: "o4",
    name: "Kit Lançamento (encerrada)",
    description: "Campanha de lançamento encerrada em setembro.",
    commissionLabel: "15% da venda",
    graceDays: 15,
    active: false,
    referrals: 64,
    sales: 12,
  },
];

export const sales: Sale[] = [
  { id: "v1", date: "2026-10-30", offerId: "o1", referrer: "Marina Souza", buyer: "C*** A.", valueCents: 148000, source: "api" },
  { id: "v2", date: "2026-10-29", offerId: "o3", referrer: "Rafael Lima", buyer: "J*** P.", valueCents: 29700, source: "api" },
  { id: "v3", date: "2026-10-27", offerId: "o2", referrer: "Marina Souza", buyer: "Empresa L***", valueCents: 480000, source: "manual" },
  { id: "v4", date: "2026-10-24", offerId: "o3", referrer: "Camila Ferraz", buyer: "T*** R.", valueCents: 29700, source: "api" },
  { id: "v5", date: "2026-10-21", offerId: "o1", referrer: "Diego Alves", buyer: "M*** S.", valueCents: 148000, source: "api" },
  { id: "v6", date: "2026-10-15", offerId: "o3", referrer: "Rafael Lima", buyer: "A*** B.", valueCents: 29700, source: "manual" },
  { id: "v7", date: "2026-10-08", offerId: "o1", referrer: "Camila Ferraz", buyer: "Empresa P***", valueCents: 148000, source: "api" },
  { id: "v8", date: "2026-09-26", offerId: "o2", referrer: "Diego Alves", buyer: "Empresa K***", valueCents: 480000, source: "manual" },
];

export const commissions: Commission[] = [
  { id: "c1", saleId: "v1", offerName: "Plano Anual Premium", referrer: "Marina Souza", pixKey: "marina***@email.com", amountCents: 14800, status: "pendente", releaseDate: "2026-11-14" },
  { id: "c2", saleId: "v2", offerName: "Curso Online Essencial", referrer: "Rafael Lima", pixKey: "***.482.***-12", amountCents: 5940, status: "pendente", releaseDate: "2026-11-05" },
  { id: "c3", saleId: "v3", offerName: "Consultoria de Implantação", referrer: "Marina Souza", pixKey: "marina***@email.com", amountCents: 30000, status: "pendente", releaseDate: "2026-11-26" },
  { id: "c4", saleId: "v4", offerName: "Curso Online Essencial", referrer: "Camila Ferraz", pixKey: "(19) 9****-3321", amountCents: 5940, status: "liberada", releaseDate: "2026-10-31" },
  { id: "c5", saleId: "v5", offerName: "Plano Anual Premium", referrer: "Diego Alves", pixKey: "diego***@email.com", amountCents: 14800, status: "liberada", releaseDate: "2026-11-05" },
  { id: "c6", saleId: "v6", offerName: "Curso Online Essencial", referrer: "Rafael Lima", pixKey: "***.482.***-12", amountCents: 5940, status: "contestada", releaseDate: "2026-10-22" },
  { id: "c7", saleId: "v7", offerName: "Plano Anual Premium", referrer: "Camila Ferraz", pixKey: "(19) 9****-3321", amountCents: 14800, status: "paga", releaseDate: "2026-10-23" },
  { id: "c8", saleId: "v8", offerName: "Consultoria de Implantação", referrer: "Diego Alves", pixKey: "diego***@email.com", amountCents: 30000, status: "paga", releaseDate: "2026-10-26" },
];

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const offerName = (id: string) => offers.find((o) => o.id === id)?.name ?? "—";
