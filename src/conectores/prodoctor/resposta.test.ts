import { describe, expect, it } from "vitest";
import { extrairRegistros } from "./resposta";

describe("extrairRegistros", () => {
  it("acha a lista de um cadastro em payload.<lista>", () => {
    const resposta = { payload: { usuarios: [{ codigo: 1 }, { codigo: 2 }] }, message: null };
    expect(extrairRegistros(resposta, "usuarios")).toEqual([{ codigo: 1 }, { codigo: 2 }]);
  });

  it("acha a lista de uma exportação em payload.exportacao.registros", () => {
    const resposta = { payload: { exportacao: { registros: [{ id: "a" }], quantidade: 1 } }, message: null };
    expect(extrairRegistros(resposta, "exportacao.registros")).toEqual([{ id: "a" }]);
  });

  it("lista ausente é erro (com a mensagem da API), nunca 'zero registros'", () => {
    const erroDaApi = { payload: null, message: "Período inválido" };
    expect(() => extrairRegistros(erroDaApi, "exportacao.registros")).toThrow(/exportacao\.registros.*Período inválido/);
    expect(() => extrairRegistros({ payload: { outra: [] } }, "usuarios")).toThrow(/usuarios/);
    expect(() => extrairRegistros({ payload: { usuarios: "x" } }, "usuarios")).toThrow(/usuarios/);
  });

  it("lista vazia de verdade continua sendo lista vazia", () => {
    expect(extrairRegistros({ payload: { exportacao: { registros: [] } } }, "exportacao.registros")).toEqual([]);
  });
});
