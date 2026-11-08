"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Card } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Empresa = { id: string; name: string; city: string | null; state: string | null; description: string | null; listing_mode: "aprovacao" | "aberto"; offers: { name: string }[] };
type Minha = { company_id: string; request_status: string; active: boolean; archived: boolean };

/** Empresas do Indiki+ que aceitam novos indicadores, com o pedido de cada uma. */
export function Vitrine({ onMudou }: { onMudou?: () => void }) {
  const [lista, setLista] = useState<Empresa[] | null>(null);
  const [minhas, setMinhas] = useState<Record<string, Minha>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const carregar = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: e }, { data: m }] = await Promise.all([sb.rpc("public_companies"), sb.from("indicator_my_companies").select("company_id, request_status, active, archived")]);
    setLista((e ?? []) as Empresa[]);
    setMinhas(Object.fromEntries(((m ?? []) as Minha[]).map((x) => [x.company_id, x])));
  }, []);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  async function pedir(e: Empresa) {
    setBusy(e.id); setMsg(null);
    const { data, error } = await supabaseBrowser().rpc("indicator_request_company", { p_company: e.id });
    setBusy("");
    if (error) return setMsg({ id: e.id, ok: false, text: error.message });
    setMsg({ id: e.id, ok: true, text: data === "aprovado" ? `Pronto! Você já indica a ${e.name}.` : `Pedido enviado. A ${e.name} vai analisar e você vê a resposta em Minha conta.` });
    await carregar();
    onMudou?.();
  }

  if (lista === null) return <p role="status" className="text-sm text-muted">Carregando empresas…</p>;
  if (lista.length === 0) return <Card className="text-sm text-muted">Nenhuma empresa está recebendo indicadores pelo site agora. Se você recebeu um convite de uma empresa, use o link dela.</Card>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {lista.map((e) => {
        const m = minhas[e.id];
        const situ = !m || (m.archived && m.request_status !== "recusado") ? null : m.request_status === "pendente" ? "pendente" : m.request_status === "recusado" ? "recusado" : m.active ? "ativo" : "pausado";
        return (
          <li key={e.id}>
            <Card className="flex h-full flex-col">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-brand bg-brand-soft text-brand"><Building2 size={20} aria-hidden /></span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{e.name}</h3>
                  {(e.city || e.state) && <p className="flex items-center gap-1 text-xs text-muted"><MapPin size={12} aria-hidden /> {[e.city, e.state].filter(Boolean).join("/")}</p>}
                </div>
              </div>
              {e.description && <p className="mt-2 text-sm text-muted">{e.description}</p>}
              {e.offers.length > 0 && <p className="mt-2 text-xs text-muted">Você indica: {e.offers.map((o) => o.name).join(", ")}</p>}
              <div className="mt-auto pt-4">
                {situ === "ativo" && <p className="flex items-center gap-1 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} aria-hidden /> Você já indica esta empresa</p>}
                {situ === "pendente" && <p className="flex items-center gap-1 text-sm font-medium text-amber-700"><Clock size={16} aria-hidden /> Pedido aguardando a empresa</p>}
                {situ === "pausado" && <p className="text-sm text-muted">A empresa pausou o seu cadastro.</p>}
                {(situ === null || situ === "recusado") && (
                  <>
                    {situ === "recusado" && <p className="mb-2 text-xs text-rose-700">A empresa recusou o pedido anterior. Você pode pedir de novo.</p>}
                    <button onClick={() => pedir(e)} disabled={busy === e.id} className="min-h-11 w-full rounded-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 disabled:opacity-60">
                      {busy === e.id ? "Enviando…" : e.listing_mode === "aberto" ? "Começar a indicar" : "Pedir para indicar"}
                    </button>
                    <p className="mt-1 text-center text-xs text-muted">{e.listing_mode === "aberto" ? "Entrada na hora" : "A empresa aprova o seu pedido"}</p>
                  </>
                )}
                {msg?.id === e.id && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
