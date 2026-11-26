import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarSugestoes } from "./sinais";

/** `db.rpc` falso com 2.500 linhas que, como o PostgREST, corta em 1000 quem não pede por `.range()`. */
function bancoCom2500Profissionais() {
  const linhas = Array.from({ length: 2500 }, (_, i) => ({
    de_para_id: i + 1,
    especialidades: i % 2 === 0 ? ["Médico Gastroenterologista"] : [],
    procedimentos: i % 2 === 0 ? 10 : 0,
    meses: 1,
  }));
  const corte = (de: number, ate: number) => ({ data: linhas.slice(de, Math.min(ate + 1, de + 1000)), error: null });
  const db = {
    rpc: (nome: string) => {
      if (nome !== "sinais_dos_profissionais") throw new Error(`rpc inesperada: ${nome}`);
      const consulta = {
        order: () => consulta,
        range: async (de: number, ate: number) => corte(de, ate),
        then: (ok: (r: unknown) => unknown) => ok(corte(0, 999)),
      };
      return consulta;
    },
  };
  return db as unknown as SupabaseClient;
}

describe("carregarSugestoes", () => {
  it("lê todos os profissionais, mesmo acima das 1000 linhas que o PostgREST devolve por vez", async () => {
    const sugestoes = await carregarSugestoes(bancoCom2500Profissionais());
    expect(sugestoes.size).toBe(2500);
    expect(sugestoes.get(2500)).toMatchObject({ sugestao: "nao_medico", procedimentos: 0 });
    expect(sugestoes.get(2499)).toMatchObject({ sugestao: "medico", especialidades: ["Médico Gastroenterologista"] });
  });
});
