import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raiz del proyecto: si no, Turbopack sube por el arbol y puede
  // encontrar un package-lock.json suelto en tu carpeta personal.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
