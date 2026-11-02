// Dados FICTÍCIOS do painel do indicador (protótipo).
// Indicador = cliente que já fechou com uma empresa que contratou o Indiki+.
// Uma pessoa pode ser cliente (e indicar) em várias empresas ao mesmo tempo, cada uma com seu link.
// "Casa Nova Reformas" é uma empresa FICTÍCIA, criada só para mostrar o caso de duas empresas.

export type PartnerCompany = {
  id: string;
  name: string;
  code: string; // link/código do indicador NESTA empresa
  customerSince: string;
  products: string[];
};

export const companies: PartnerCompany[] = [
  {
    id: "soulglass",
    name: "Soulglass",
    code: "MARINA7K",
    customerSince: "setembro de 2026",
    products: ["Envidraçamento de sacada", "Box de banheiro", "Guarda-corpo de vidro", "Outro"],
  },
  {
    id: "casanova",
    name: "Casa Nova Reformas",
    code: "MARINA-CN4",
    customerSince: "julho de 2026",
    products: ["Reforma de banheiro", "Pintura", "Piso e revestimento", "Outro"],
  },
];

export const companyById = (id: string) => companies.find((c) => c.id === id) ?? companies[0];

export const me = {
  name: "Marina Souza",
  firstName: "Marina",
  phone: "(19) 90000-1234",
  pix: "marina***@email.com",
};

/** Códigos que a página pública /i/[código] reconhece neste protótipo. */
export const KNOWN_CODES: Record<string, { firstName: string; companyId: string }> = {
  MARINA7K: { firstName: "Marina", companyId: "soulglass" },
  "MARINA-CN4": { firstName: "Marina", companyId: "casanova" },
  RAFAEL3Q: { firstName: "Rafael", companyId: "soulglass" },
};

export type Stage = "indicado" | "orcamento" | "fechou" | "instalada" | "paga" | "perdido";

/** Etapas na ordem em que acontecem (perdido fica de fora: é um desvio). */
export const STAGES: { key: Exclude<Stage, "perdido">; label: string; hint: string }[] = [
  { key: "indicado", label: "Indicado", hint: "A empresa recebeu o pedido de orçamento." },
  { key: "orcamento", label: "Orçamento", hint: "O orçamento foi enviado ao seu amigo." },
  { key: "fechou", label: "Fechou", hint: "Seu amigo fechou com a empresa." },
  { key: "instalada", label: "Instalado e pago", hint: "A obra foi feita e paga. Sua comissão é liberada." },
  { key: "paga", label: "Comissão paga", hint: "A empresa pagou a sua comissão." },
];

export type Referral = {
  id: string;
  companyId: string;
  friend: string; // só primeiro nome + inicial: privacidade do indicado
  offer: string;
  date: string; // ISO
  stage: Stage;
  via: "link" | "nome";
};

export const referrals: Referral[] = [
  { id: "r6", companyId: "soulglass", friend: "Beatriz F.", offer: "Guarda-corpo de vidro", date: "2026-11-01", stage: "indicado", via: "link" },
  { id: "r1", companyId: "soulglass", friend: "João P.", offer: "Box de banheiro", date: "2026-10-30", stage: "orcamento", via: "link" },
  { id: "r2", companyId: "soulglass", friend: "Carla M.", offer: "Envidraçamento de sacada", date: "2026-10-20", stage: "fechou", via: "nome" },
  { id: "r5", companyId: "soulglass", friend: "Paulo R.", offer: "Guarda-corpo de vidro", date: "2026-10-08", stage: "perdido", via: "nome" },
  { id: "r3", companyId: "soulglass", friend: "Sérgio T.", offer: "Envidraçamento de sacada", date: "2026-09-28", stage: "instalada", via: "link" },
  { id: "r4", companyId: "soulglass", friend: "Ana L.", offer: "Box de banheiro", date: "2026-09-12", stage: "paga", via: "link" },
  { id: "r7", companyId: "soulglass", friend: "Rui S.", offer: "Box de banheiro", date: "2026-08-20", stage: "paga", via: "link" },
];

referrals.push(
  { id: "r8", companyId: "casanova", friend: "Helena K.", offer: "Reforma de banheiro", date: "2026-10-26", stage: "fechou", via: "link" },
  { id: "r9", companyId: "casanova", friend: "Otávio B.", offer: "Pintura", date: "2026-09-02", stage: "paga", via: "nome" },
);

referrals.sort((a, b) => b.date.localeCompare(a.date));

export type MyCommissionStatus = "pendente" | "liberada" | "paga" | "confirmada" | "contestada";

export type MyCommission = {
  id: string;
  companyId: string;
  friend: string;
  offer: string;
  amountCents: number;
  status: MyCommissionStatus;
  note: string;
};

export const myCommissions: MyCommission[] = [
  { id: "m1", companyId: "soulglass", friend: "Carla M.", offer: "Envidraçamento de sacada", amountCents: 30000, status: "pendente", note: "Libera depois da instalação e do pagamento da obra." },
  { id: "m2", companyId: "soulglass", friend: "Sérgio T.", offer: "Envidraçamento de sacada", amountCents: 30000, status: "liberada", note: "A empresa vai pagar via PIX para a sua chave." },
  { id: "m3", companyId: "soulglass", friend: "Ana L.", offer: "Box de banheiro", amountCents: 10000, status: "paga", note: "A empresa informou o pagamento. Confirme se recebeu." },
  { id: "m4", companyId: "soulglass", friend: "Rui S.", offer: "Box de banheiro", amountCents: 10000, status: "confirmada", note: "Você confirmou o recebimento." },
];

myCommissions.push(
  { id: "m5", companyId: "casanova", friend: "Helena K.", offer: "Reforma de banheiro", amountCents: 15000, status: "pendente", note: "Libera depois da obra e do pagamento." },
  { id: "m6", companyId: "casanova", friend: "Otávio B.", offer: "Pintura", amountCents: 5000, status: "paga", note: "A empresa informou o pagamento. Confirme se recebeu." },
);

export const STATUS_INFO: Record<MyCommissionStatus, { label: string; cls: string }> = {
  pendente: { label: "Aguardando obra", cls: "bg-slate-100 text-slate-700" },
  liberada: { label: "Empresa vai pagar", cls: "bg-amber-100 text-amber-800" },
  paga: { label: "Pago: confirme", cls: "bg-sky-100 text-sky-800" },
  confirmada: { label: "Recebida", cls: "bg-emerald-100 text-emerald-800" },
  contestada: { label: "Em disputa", cls: "bg-rose-100 text-rose-800" },
};
