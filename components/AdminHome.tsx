"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase-browser";

/** Início da administração: números reais do banco. As telas de gestão entram uma a uma. */
export function AdminHome() {
  const [n, setN] = useState<{ empresas: number; indicadores: number; indicacoes: number } | null>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = supabaseBrowser();
    (async () => {
      const count = async (t: string) => (await sb.from(t).select("*", { count: "exact", head: true })).count ?? 0;
      setN({ empresas: await count("companies"), indicadores: await count("referrer_links"), indicacoes: await count("referrals") });
    })();
  }, []);

  const items: [string, number | undefined][] = [
    ["Empresas", n?.empresas], ["Indicadores", n?.indicadores], ["Indicações", n?.indicacoes],
  ];
  return (
    <>
      <PageHeader title="Início" subtitle="Plataforma no ar, sem dados de teste. Aqui entram a gestão de empresas, planos, cobrança e fiscal, uma tela de cada vez." />
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map(([label, v]) => (
          <Card key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{v ?? "…"}</p>
          </Card>
        ))}
      </div>
      <Link href="/admin/empresas" className="mt-6 inline-block rounded-brand bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:opacity-90">Gerenciar empresas e acessos</Link>
    </>
  );
}
