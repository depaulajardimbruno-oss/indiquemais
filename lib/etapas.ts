export type Stage = "indicado" | "orcamento" | "fechou" | "instalada" | "paga" | "perdido";

/** Etapas na ordem em que acontecem (perdido fica de fora: é um desvio). */
export const STAGES: { key: Exclude<Stage, "perdido">; label: string; hint: string }[] = [
  { key: "indicado", label: "Indicado", hint: "A empresa recebeu o pedido de orçamento." },
  { key: "orcamento", label: "Orçamento", hint: "O orçamento foi enviado ao seu amigo." },
  { key: "fechou", label: "Fechou", hint: "Seu amigo fechou com a empresa." },
  { key: "instalada", label: "Instalado e pago", hint: "A obra foi feita e paga. Sua comissão é liberada." },
  { key: "paga", label: "Comissão paga", hint: "O Indiki+ pagou a sua comissão." },
];
