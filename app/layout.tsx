import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "@fontsource-variable/inter";
import "./globals.css";
import { brandCssVars, getBrand } from "@/lib/brand";
import { EnvBanner } from "@/components/EnvBanner";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: brand.tagline,
    other: { "theme-color": "#ff6600" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const brand = await getBrand();
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
      style={brandCssVars(brand) as CSSProperties}
    >
      <body className="min-h-full flex flex-col">
        <EnvBanner />
        {children}
      </body>
    </html>
  );
}
