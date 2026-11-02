export type AppEnv = "producao" | "homologacao" | "teste" | "desenvolvimento";

/** Descobre em qual ambiente esta versão do site está rodando.
 *  - main                → produção
 *  - staging             → homologação (cliente valida aqui)
 *  - develop / feature/* → teste
 *  - máquina local       → desenvolvimento
 *  Usa as variáveis que a própria Vercel injeta em cada deploy. */
export function getAppEnv(): AppEnv {
  const vercelEnv = process.env.VERCEL_ENV;
  if (!vercelEnv) return "desenvolvimento";
  if (vercelEnv === "production") return "producao";

  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  return branch === "staging" ? "homologacao" : "teste";
}

export const ENV_LABEL: Record<AppEnv, string> = {
  producao: "Produção",
  homologacao: "Homologação",
  teste: "Teste",
  desenvolvimento: "Desenvolvimento local",
};
