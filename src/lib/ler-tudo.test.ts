import { describe, expect, it } from "vitest";
import { LINHAS_POR_PAGINA, lerTudo } from "./ler-tudo";

describe("lerTudo", () => {
  it("junta todas as páginas mesmo quando a fonte corta em 1000 linhas", async () => {
    const fonte = Array.from({ length: 2667 }, (_, i) => i);
    const pedidos: [number, number][] = [];
    const todas = await lerTudo(async (de, ate) => {
      pedidos.push([de, ate]);
      return { data: fonte.slice(de, Math.min(ate + 1, de + LINHAS_POR_PAGINA)), error: null };
    }, "teste");
    expect(todas).toHaveLength(2667);
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("propaga erro da consulta com contexto", async () => {
    await expect(lerTudo(async () => ({ data: null, error: { message: "boom" } }), "ler x")).rejects.toThrow(/ler x: boom/);
  });
});
