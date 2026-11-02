import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { MORE_ITEMS } from "@/components/empresaItems";

export const metadata = { title: "Mais" };

export default function MaisPage() {
  return (
    <>
      <PageHeader title="Mais" />
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 px-4 py-4 text-sm font-medium">
                <Icon size={20} aria-hidden className="text-brand" />
                {label}
                <ChevronRight size={18} aria-hidden className="ml-auto text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
