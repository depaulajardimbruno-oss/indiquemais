"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { Equipe } from "@/components/Equipe";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEmpresa } from "@/components/empresa/EmpresaContext";

export function EquipePagina() {
  const { empresa } = useEmpresa();
  const [meuId, setMeuId] = useState<string>();
  useEffect(() => { supabaseBrowser().auth.getSession().then(({ data }) => setMeuId(data.session?.user.id)); }, []);
  return (
    <>
      <PageHeader title="Equipe" subtitle={empresa.can_edit ? "Quem da sua empresa acessa este painel." : "Só o administrador da empresa libera ou remove acessos."} />
      <Equipe companyId={empresa.id} companyName={empresa.name} canEdit={empresa.can_edit} meuId={meuId} />
    </>
  );
}
