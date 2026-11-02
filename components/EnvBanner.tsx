import { ENV_LABEL, getAppEnv, type AppEnv } from "@/lib/env";

const STYLE: Record<Exclude<AppEnv, "producao">, string> = {
  teste: "bg-sky-600 text-white",
  homologacao: "bg-violet-700 text-white",
  desenvolvimento: "bg-slate-800 text-white",
};

const NOTE: Record<Exclude<AppEnv, "producao">, string> = {
  teste: "versão em teste, pode estar quebrada",
  homologacao: "versão para validação do cliente, ainda não é a final",
  desenvolvimento: "rodando na máquina do desenvolvedor",
};

/** Faixa fixa no topo, só fora de produção, para ninguém confundir os ambientes. */
export function EnvBanner() {
  const env = getAppEnv();
  if (env === "producao") return null;
  return (
    <div
      role="status"
      className={`px-4 py-1.5 text-center text-xs font-medium ${STYLE[env]}`}
    >
      Ambiente de {ENV_LABEL[env].toLowerCase()}: {NOTE[env]}
    </div>
  );
}
