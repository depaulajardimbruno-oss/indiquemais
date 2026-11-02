import Image from "next/image";
import logo from "@/public/brand/indiki-logo.png";

/** Logo da marca. Se o banco (brand_settings) tiver um logo próprio, usa ele; senão, o Indiki+ oficial. */
export function Logo({ name, logoUrl, height = 32 }: { name: string; logoUrl?: string | null; height?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ height }} className="w-auto" />;
  }
  return <Image src={logo} alt={name} height={height} style={{ height, width: "auto" }} priority />;
}
