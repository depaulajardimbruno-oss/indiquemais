import { Building2 } from "lucide-react";
import { companyById } from "@/lib/indicador";

/** Mostra de qual empresa vem a indicação ou a comissão. */
export function CompanyBadge({ companyId }: { companyId: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
      <Building2 size={13} aria-hidden />
      {companyById(companyId).name}
    </span>
  );
}
