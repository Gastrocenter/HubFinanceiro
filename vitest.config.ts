import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

const alias = { "@": path.resolve(__dirname, "src") };

export default defineConfig(({ mode }) => ({
  resolve: { alias },
  test: {
    projects: [
      {
        // Sem .env: um teste unitário nunca enxerga credencial nem toca serviço real.
        resolve: { alias },
        test: { name: "unitarios", include: ["src/**/*.test.ts"], exclude: ["src/integracao/**"], environment: "node" },
      },
      {
        // Toca o Supabase e o ProDoctor reais (.env.local). Só roda por `npm run test:integracao`.
        resolve: { alias },
        test: { name: "integracao", include: ["src/integracao/**/*.test.ts"], environment: "node", env: loadEnv(mode, process.cwd(), "") },
      },
    ],
  },
}));
