import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Carrega .env.local (valores públicos do Supabase) para os testes de integração.
    env: loadEnv(mode, process.cwd(), ""),
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
}));
