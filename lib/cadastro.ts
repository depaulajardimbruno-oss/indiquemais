/** Versão dos termos que a pessoa aceita no cadastro. Ao mudar o texto de /termos, aumente a versão. */
export const TERMS_VERSION = "v1";

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export type PixType = "cpf" | "telefone" | "email" | "aleatoria" | "cnpj";
export const PIX_TYPES: { value: PixType; label: string; hint: string }[] = [
  { value: "cpf", label: "CPF", hint: "Use o mesmo CPF do cadastro, só números." },
  { value: "telefone", label: "Celular", hint: "DDD + número." },
  { value: "email", label: "E-mail", hint: "O e-mail cadastrado no seu banco para o PIX." },
  { value: "aleatoria", label: "Chave aleatória", hint: "Aquela sequência de letras e números do seu banco." },
  { value: "cnpj", label: "CNPJ", hint: "Se você recebe pela sua empresa." },
];

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function maskCpf(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskPhone(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validCpf(s: string) {
  const c = onlyDigits(s);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(c[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}

/** Maior data de nascimento aceita (18 anos completos hoje), no formato AAAA-MM-DD. */
export function maxBirthDate(now: Date) {
  const d = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return d.toISOString().slice(0, 10);
}
