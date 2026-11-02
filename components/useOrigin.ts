import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Endereço do site no ambiente atual (teste, homologação ou produção). Vazio no servidor. */
export function useOrigin() {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}
