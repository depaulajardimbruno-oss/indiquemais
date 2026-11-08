import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_PASSWORD = 8;

/** Só aceita caminhos internos (evita redirecionar para outro site). */
export function destinoSeguro(destino: string | null | undefined) {
  return destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : null;
}

/** Para onde ir depois de entrar: o destino pedido, ou o painel conforme o papel. */
export async function destinoAposEntrar(sb: SupabaseClient, destino?: string | null) {
  const seguro = destinoSeguro(destino);
  if (seguro) return seguro;
  const { data: isAdmin } = await sb.rpc("is_platform_admin");
  return isAdmin === true ? "/admin" : "/conta";
}

export function validarSenha(senha: string, confirma?: string) {
  if (senha.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  if (confirma !== undefined && senha !== confirma) return "As duas senhas não são iguais.";
  return null;
}

/** Traduz as mensagens do Supabase que aparecem para a pessoa. */
export function mensagemAuth(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme o seu e-mail antes de entrar. Procure o link que enviamos (veja também o spam).";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (/already registered|already exists/i.test(msg)) return "Este e-mail já tem conta. Use \"Já tenho conta\" para entrar.";
  if (/password should be|weak password/i.test(msg)) return "Senha fraca. Use pelo menos 8 caracteres, com letras e números.";
  if (/same password|different from the old/i.test(msg)) return "A nova senha precisa ser diferente da atual.";
  return "Não foi possível concluir agora. Tente de novo em alguns minutos.";
}
