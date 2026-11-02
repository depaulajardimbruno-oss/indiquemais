import { sealSvg } from "@/lib/selo";

/** Selo do Indiki+ (mesmo desenho da imagem que a empresa coloca no site dela). */
export function SealBadge({ level, label, size = 120, id = "s" }: { level: string; label: string; size?: number; id?: string }) {
  return <span className="inline-block leading-none" dangerouslySetInnerHTML={{ __html: sealSvg(level, label, size, id) }} />;
}
