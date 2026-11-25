import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const TABELAS = ["perfis_usuarios", "auditoria"] as const;

function chamar(tabela: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${tabela}`, {
    ...init,
    headers: {
      apikey: chavePublica!,
      Authorization: `Bearer ${chavePublica}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe.skipIf(!url || !chavePublica)("isolamento do navegador (chave pública)", () => {
  for (const tabela of TABELAS) {
    it(`não lê nada de ${tabela}`, async () => {
      const resposta = await chamar(`${tabela}?select=*`);
      const corpo = await resposta.json();
      // 42501 = permission denied. Um 404 (tabela inexistente) não vale como prova.
      expect(resposta.status).toBe(401);
      expect(corpo.code).toBe("42501");
    });

    it(`não grava em ${tabela}`, async () => {
      const corpo = tabela === "auditoria" ? { acao: "invasao" } : { usuario_id: "00000000-0000-0000-0000-000000000000", perfil: "admin" };
      const resposta = await chamar(tabela, { method: "POST", body: JSON.stringify(corpo) });
      expect(resposta.status).toBe(401);
      expect((await resposta.json()).code).toBe("42501");
    });
  }
});
