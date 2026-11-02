// Dados FICTÍCIOS da plataforma (protótipo). Espelham as tabelas do banco (migrações 5 a 8)
// e os valores iniciais que já estão lá. Quando o site for ligado ao Supabase, só esta camada muda.

export type Plan = {
  code: string;
  name: string;
  description: string;
  priceCents: number | null; // null = a definir
  feeBps: number;
  maxReferrers: number | null; // null = ilimitado
  maxOffers: number | null;
  maxMembers: number | null;
  report: "basico" | "mensal" | "completo";
  crm: boolean;
  highlight: boolean;
  support: "email" | "whatsapp" | "prioritario";
  active: boolean;
};

export const PLANS: Plan[] = [
  { code: "inicial", name: "Inicial", description: "Para começar a indicar com poucos clientes.", priceCents: null, feeBps: 100, maxReferrers: 10, maxOffers: 3, maxMembers: 1, report: "basico", crm: false, highlight: false, support: "email", active: true },
  { code: "intermediario", name: "Intermediário", description: "Mais indicadores e relatório mensal em planilha.", priceCents: null, feeBps: 80, maxReferrers: 50, maxOffers: 10, maxMembers: 2, report: "mensal", crm: false, highlight: false, support: "email", active: true },
  { code: "avancado", name: "Avançado", description: "Integração com o CRM e equipe maior.", priceCents: null, feeBps: 60, maxReferrers: 200, maxOffers: null, maxMembers: 5, report: "completo", crm: true, highlight: false, support: "whatsapp", active: true },
  { code: "avancado_mais", name: "Avançado+", description: "Sem limites, destaque na vitrine e suporte prioritário.", priceCents: null, feeBps: 50, maxReferrers: null, maxOffers: null, maxMembers: null, report: "completo", crm: true, highlight: true, support: "prioritario", active: true },
];

export const REPORT_LABEL = { basico: "Básico", mensal: "Mensal em planilha", completo: "Completo" } as const;
export const SUPPORT_LABEL = { email: "E-mail", whatsapp: "WhatsApp", prioritario: "Prioritário" } as const;

export type Group = { code: string; name: string; description: string; planCode: string; active: boolean };
export const GROUPS: Group[] = [
  { code: "autonomo", name: "Profissional autônomo", description: "Trabalha sozinho ou com pouca equipe, poucos clientes ativos.", planCode: "inicial", active: true },
  { code: "pequena", name: "Pequena empresa", description: "Equipe pequena e carteira de clientes em crescimento.", planCode: "intermediario", active: true },
  { code: "media", name: "Média empresa", description: "Vários vendedores, usa CRM e precisa de relatórios completos.", planCode: "avancado", active: true },
  { code: "grande", name: "Grande empresa ou rede", description: "Operação grande, várias unidades, sem limite de indicadores.", planCode: "avancado_mais", active: true },
];

// ---------- Selo da empresa ----------
export type SealLevel = { code: string; name: string; minPoints: number; minSales: number; active: boolean };
export const SEAL_LEVELS: SealLevel[] = [
  { code: "bronze", name: "Bronze", minPoints: 0, minSales: 0, active: true },
  { code: "prata", name: "Prata", minPoints: 100, minSales: 5, active: true },
  { code: "ouro", name: "Ouro", minPoints: 300, minSales: 20, active: true },
  { code: "platina", name: "Platina", minPoints: 700, minSales: 50, active: true },
  { code: "diamante", name: "Diamante", minPoints: 1500, minSales: 120, active: true },
];

export type Criterion = { code: string; name: string; description: string; weight: number; max: number | null; active: boolean };
export const SEAL_CRITERIA: Criterion[] = [
  { code: "closed_sales", name: "Vendas fechadas", description: "Vendas por indicação com número de contrato registrado.", weight: 10, max: null, active: true },
  { code: "confirmed_commissions", name: "Indicadores que confirmaram", description: "Comissões que o indicador confirmou ter recebido corretamente.", weight: 15, max: null, active: true },
  { code: "disputes", name: "Contestações", description: "Comissões contestadas pelo indicador (desconta pontos).", weight: -25, max: null, active: true },
  { code: "months_active", name: "Tempo de casa", description: "Meses desde o cadastro da empresa.", weight: 5, max: 60, active: true },
  { code: "fee_on_time", name: "Faturas pagas em dia", description: "Faturas (taxas e repasses) pagas até o vencimento.", weight: 10, max: null, active: false },
];

// ---------- Ranking do indicador ----------
export type Tier = { code: string; name: string; minPoints: number; active: boolean };
export const TIERS: Tier[] = [
  { code: "nivel1", name: "Nível 1", minPoints: 0, active: true },
  { code: "nivel2", name: "Nível 2", minPoints: 50, active: true },
  { code: "nivel3", name: "Nível 3", minPoints: 150, active: true },
  { code: "nivel4", name: "Nível 4", minPoints: 400, active: true },
  { code: "nivel5", name: "Nível 5", minPoints: 1000, active: true },
];
export const TIER_CRITERIA: Criterion[] = [
  { code: "closed_referrals", name: "Indicações fechadas", description: "Indicações que viraram venda.", weight: 10, max: null, active: true },
  { code: "confirmed_commissions", name: "Comissões confirmadas", description: "Comissões que o indicador confirmou ter recebido.", weight: 15, max: null, active: true },
  { code: "companies_count", name: "Empresas em que já vendeu", description: "Empresas diferentes com ao menos 1 venda.", weight: 20, max: 100, active: true },
  { code: "months_active", name: "Tempo de casa", description: "Meses desde o cadastro.", weight: 3, max: 36, active: true },
];
// Benefícios de EXEMPLO: ainda serão definidos. Cada um pode ser ativado ou desativado.
export type Benefit = { id: number; tier: string; title: string; description: string; active: boolean };
export const BENEFITS: Benefit[] = [
  { id: 1, tier: "nivel1", title: "Painel de indicações", description: "Acompanhe cada indicação e comissão em um só lugar.", active: true },
  { id: 2, tier: "nivel2", title: "Prioridade no atendimento", description: "Suas indicações são contatadas primeiro. (exemplo)", active: true },
  { id: 3, tier: "nivel3", title: "Selo de indicador no perfil", description: "Mostre seu nível para quem você indica. (exemplo)", active: true },
  { id: 4, tier: "nivel4", title: "Convite para eventos dos parceiros", description: "(exemplo, a definir)", active: false },
  { id: 5, tier: "nivel5", title: "Brinde anual", description: "(exemplo, a definir)", active: false },
];

// ---------- Cálculo (mesma regra do banco, para os simuladores) ----------
export type Metrics = Record<string, number>;
export function calcPoints(metrics: Metrics, criteria: Criterion[]): number {
  const raw = criteria
    .filter((c) => c.active)
    .reduce((sum, c) => sum + Math.min((metrics[c.code] ?? 0) * c.weight, c.max ?? Number.MAX_SAFE_INTEGER), 0);
  return Math.max(0, raw);
}
export function sealFor(points: number, sales: number, levels: SealLevel[]): SealLevel | null {
  const ok = levels.filter((l) => l.active && points >= l.minPoints && sales >= l.minSales);
  return ok.length ? ok[ok.length - 1] : null;
}
export function tierFor(points: number, tiers: Tier[]): Tier | null {
  const ok = tiers.filter((t) => t.active && points >= t.minPoints);
  return ok.length ? ok[ok.length - 1] : null;
}

// ---------- Empresas (visão do administrador) ----------
export type AdminCompany = {
  id: string; name: string; group: string; plan: string; seal: string | null; points: number;
  referrers: number; offers: number; members: number; sales: number; status: "ativa" | "suspensa";
};
export const ADMIN_COMPANIES: AdminCompany[] = [
  { id: "soulglass", name: "Soulglass", group: "media", plan: "avancado", seal: "prata", points: 245, referrers: 18, offers: 4, members: 2, sales: 12, status: "ativa" },
  { id: "casanova", name: "Casa Nova Reformas", group: "pequena", plan: "intermediario", seal: "bronze", points: 40, referrers: 6, offers: 3, members: 1, sales: 2, status: "ativa" },
  { id: "vidracaria-sol", name: "Vidraçaria Sol", group: "autonomo", plan: "inicial", seal: null, points: 0, referrers: 1, offers: 1, members: 1, sales: 0, status: "ativa" },
];

// ---------- Cobrança ----------
export type InvoiceKind = "mensalidade" | "taxa_vendas" | "repasse_comissoes";
export type InvoiceStatus = "aberta" | "vencida" | "paga" | "cancelada";
export type Invoice = {
  id: string; number: string; companyId: string; company: string; kind: InvoiceKind; period: string; description: string;
  amountCents: number; status: InvoiceStatus; due: string; paidAt?: string; receipt?: string; note?: string;
  items?: { description: string; baseCents?: number; feeBps?: number; amountCents: number }[];
};
export const KIND_LABEL: Record<InvoiceKind, string> = {
  mensalidade: "Mensalidade",
  taxa_vendas: "Taxa sobre vendas",
  repasse_comissoes: "Repasse de comissões",
};
export const INVOICES: Invoice[] = [
  { id: "f4", number: "F-2026-000004", companyId: "soulglass", company: "Soulglass", kind: "repasse_comissoes", period: "11/2026", description: "Repasse de comissões aos indicadores", amountCents: 70000, status: "aberta", due: "12/11/2026",
    items: [{ description: "Comissão, contrato PED-2026-0412, Marina Souza", baseCents: 2000000, amountCents: 40000 }, { description: "Comissão, contrato PED-2026-0398, Pedro Álvares", baseCents: 600000, amountCents: 30000 }] },
  { id: "f3", number: "F-2026-000003", companyId: "soulglass", company: "Soulglass", kind: "taxa_vendas", period: "10/2026", description: "Taxa sobre vendas por indicação", amountCents: 19250, status: "paga", due: "11/11/2026", paidAt: "03/11/2026", receipt: "R-2026-000001", note: "NFS-e 1234",
    items: [{ description: "Venda, contrato PED-2026-0412", baseCents: 2000000, feeBps: 50, amountCents: 10000 }, { description: "Venda, contrato PED-2026-0398", baseCents: 600000, feeBps: 50, amountCents: 3000 }, { description: "Venda, contrato PED-2026-0377", baseCents: 1250000, feeBps: 50, amountCents: 6250 }] },
  { id: "f2", number: "F-2026-000002", companyId: "soulglass", company: "Soulglass", kind: "mensalidade", period: "11/2026", description: "Mensalidade do plano Avançado", amountCents: 29900, status: "paga", due: "12/11/2026", paidAt: "02/11/2026", receipt: "R-2026-000002" },
  { id: "f5", number: "F-2026-000005", companyId: "casanova", company: "Casa Nova Reformas", kind: "mensalidade", period: "11/2026", description: "Mensalidade do plano Intermediário", amountCents: 14900, status: "vencida", due: "28/10/2026" },
  { id: "f6", number: "F-2026-000006", companyId: "vidracaria-sol", company: "Vidraçaria Sol", kind: "mensalidade", period: "11/2026", description: "Mensalidade do plano Inicial", amountCents: 7900, status: "aberta", due: "12/11/2026" },
];
export const PRICES_NOTE = "Preços de exemplo, só para montar a tela. Os valores dos planos ainda não foram definidos.";

// ---------- Certificados ----------
export type Cert = { code: string; company: string; level: string; issuedAt: string; validUntil: string; status: "valido" | "revogado" | "expirado" | "desatualizado"; reason?: string };
export const CERTS: Cert[] = [
  { code: "IM-K7QX-2M9A", company: "Soulglass", level: "prata", issuedAt: "12/10/2026", validUntil: "12/10/2027", status: "valido" },
  { code: "IM-3HPD-8WZT", company: "Casa Nova Reformas", level: "bronze", issuedAt: "05/09/2026", validUntil: "05/09/2027", status: "valido" },
  { code: "IM-R4NB-6CVE", company: "Soulglass", level: "bronze", issuedAt: "01/09/2026", validUntil: "01/09/2027", status: "revogado", reason: "Nível do selo mudou" },
];
export const certByCode = (code: string) => CERTS.find((c) => c.code === code.trim().toUpperCase());
export const levelName = (code: string) => SEAL_LEVELS.find((l) => l.code === code)?.name ?? code;

// ---------- Fiscal ----------
export type TaxRule = { code: string; kind: "IRRF" | "INSS"; description: string; rateBps: number; minBaseCents: number; active: boolean; note: string };
export const TAX_RULES: TaxRule[] = [
  { code: "irrf_comissao", kind: "IRRF", description: "Imposto de renda retido na fonte sobre a comissão paga ao indicador (pessoa física).", rateBps: 0, minBaseCents: 0, active: false, note: "Definir com o contador: tabela progressiva, base e isenções." },
  { code: "inss_comissao", kind: "INSS", description: "Contribuição previdenciária retida do indicador (contribuinte individual).", rateBps: 0, minBaseCents: 0, active: false, note: "Definir com o contador: alíquota, teto e se se aplica ao caso." },
];
export type Informe = { number: string; year: number; version: number; beneficiary: string; cpf: string | null; grossCents: number; irrfCents: number; inssCents: number; payments: number };
export const INFORMES: Informe[] = [
  { number: "IR-2026-000001", year: 2026, version: 2, beneficiary: "Marina Souza", cpf: "390.533.447-05", grossCents: 30000, irrfCents: 0, inssCents: 0, payments: 1 },
  { number: "IR-2026-000002", year: 2026, version: 1, beneficiary: "Pedro Álvares", cpf: null, grossCents: 40000, irrfCents: 0, inssCents: 0, payments: 1 },
];

// ---------- Ranking (placar de exemplo) ----------
export const LEADERBOARD = [
  { position: 1, name: "Carlos M.", tier: "Nível 3", points: 190, me: false },
  { position: 2, name: "Indicador anônimo", tier: "Nível 3", points: 160, me: false },
  { position: 3, name: "Marina S.", tier: "Nível 2", points: 95, me: true },
  { position: 4, name: "Indicador anônimo", tier: "Nível 2", points: 70, me: false },
  { position: 5, name: "Paula R.", tier: "Nível 2", points: 55, me: false },
  { position: 6, name: "Indicador anônimo", tier: "Nível 1", points: 30, me: false },
];
