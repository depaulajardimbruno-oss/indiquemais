// Dados FICTÍCIOS do painel do indicador (protótipo).
// Indicador = cliente que já fechou com a empresa piloto e indica amigos e vizinhos.

export const me = {
  name: "Marina Souza",
  firstName: "Marina",
  code: "MARINA7K",
  phone: "(19) 90000-1234",
  company: "Soulglass",
  customerSince: "setembro de 2026",
  pix: "marina***@email.com",
};

/** Códigos que a página pública /i/[código] reconhece neste protótipo. */
export const KNOWN_CODES: Record<string, { firstName: string }> = {
  MARINA7K: { firstName: "Marina" },
  RAFAEL3Q: { firstName: "Rafael" },
};

export type Stage = "indicado" | "orcamento" | "fechou" | "instalada" | "paga" | "perdido";

/** Etapas na ordem em que acontecem (perdido fica de fora: é um desvio). */
export const STAGES: { key: Exclude<Stage, "perdido">; label: string; hint: string }[] = [
  { key: "indicado", label: "Indicado", hint: "A Soulglass recebeu o pedido de orçamento." },
  { key: "orcamento", label: "Orçamento", hint: "O orçamento foi enviado ao seu amigo." },
  { key: "fechou", label: "Fechou", hint: "Seu amigo fechou com a Soulglass." },
  { key: "instalada", label: "Instalado e pago", hint: "A obra foi feita e paga. Sua comissão é liberada." },
  { key: "paga", label: "Comissão paga", hint: "A Soulglass pagou a sua comissão." },
];

export type Referral = {
  id: string;
  friend: string; // só primeiro nome + inicial: privacidade do indicado
  offer: string;
  date: string; // ISO
  stage: Stage;
  via: "link" | "nome";
};

export const referrals: Referral[] = [
  { id: "r6", friend: "Beatriz F.", offer: "Guarda-corpo de vidro", date: "2026-11-01", stage: "indicado", via: "link" },
  { id: "r1", friend: "João P.", offer: "Box de banheiro", date: "2026-10-30", stage: "orcamento", via: "link" },
  { id: "r2", friend: "Carla M.", offer: "Envidraçamento de sacada", date: "2026-10-20", stage: "fechou", via: "nome" },
  { id: "r5", friend: "Paulo R.", offer: "Guarda-corpo de vidro", date: "2026-10-08", stage: "perdido", via: "nome" },
  { id: "r3", friend: "Sérgio T.", offer: "Envidraçamento de sacada", date: "2026-09-28", stage: "instalada", via: "link" },
  { id: "r4", friend: "Ana L.", offer: "Box de banheiro", date: "2026-09-12", stage: "paga", via: "link" },
  { id: "r7", friend: "Rui S.", offer: "Box de banheiro", date: "2026-08-20", stage: "paga", via: "link" },
];

export type MyCommissionStatus = "pendente" | "liberada" | "paga" | "confirmada" | "contestada";

export type MyCommission = {
  id: string;
  friend: string;
  offer: string;
  amountCents: number;
  status: MyCommissionStatus;
  note: string;
};

export const myCommissions: MyCommission[] = [
  { id: "m1", friend: "Carla M.", offer: "Envidraçamento de sacada", amountCents: 30000, status: "pendente", note: "Libera depois da instalação e do pagamento da obra." },
  { id: "m2", friend: "Sérgio T.", offer: "Envidraçamento de sacada", amountCents: 30000, status: "liberada", note: "A Soulglass vai pagar via PIX para a sua chave." },
  { id: "m3", friend: "Ana L.", offer: "Box de banheiro", amountCents: 10000, status: "paga", note: "A Soulglass informou o pagamento. Confirme se recebeu." },
  { id: "m4", friend: "Rui S.", offer: "Box de banheiro", amountCents: 10000, status: "confirmada", note: "Você confirmou o recebimento." },
];

export const STATUS_INFO: Record<MyCommissionStatus, { label: string; cls: string }> = {
  pendente: { label: "Aguardando obra", cls: "bg-slate-100 text-slate-700" },
  liberada: { label: "Empresa vai pagar", cls: "bg-amber-100 text-amber-800" },
  paga: { label: "Pago: confirme", cls: "bg-sky-100 text-sky-800" },
  confirmada: { label: "Recebida", cls: "bg-emerald-100 text-emerald-800" },
  contestada: { label: "Em disputa", cls: "bg-rose-100 text-rose-800" },
};

export const PRODUCTS = ["Envidraçamento de sacada", "Box de banheiro", "Guarda-corpo de vidro", "Outro"];
