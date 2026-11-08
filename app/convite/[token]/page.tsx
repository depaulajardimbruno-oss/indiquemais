import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { ConviteFlow } from "@/components/ConviteFlow";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Convite para indicar" };

async function Flow({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  return <ConviteFlow token={decodeURIComponent(token).toUpperCase()} />;
}

export default async function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  const brand = await getBrand();
  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-4 md:py-10">
      <div className="mb-6 flex justify-center"><Logo name={brand.name} logoUrl={brand.logoUrl} height={30} /></div>
      <Suspense fallback={<p className="text-center text-sm text-muted" role="status">Abrindo o convite…</p>}>
        <Flow params={params} />
      </Suspense>
    </main>
  );
}
