import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Endereços do site piloto (indikimais.com.br) continuam funcionando depois da troca de DNS.
  async redirects() {
    return [
      { source: "/login", destination: "/entrar", permanent: true },
      { source: "/register", has: [{ type: "query", key: "user_type", value: "empresa" }], destination: "/cadastro-empresa", permanent: false },
      { source: "/register", destination: "/cadastro", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
