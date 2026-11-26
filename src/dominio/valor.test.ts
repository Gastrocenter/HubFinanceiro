import { describe, expect, it } from "vitest";
import { compararValores, lerValorProDoctor } from "./valor";

describe("lerValorProDoctor", () => {
  it("lê vírgula decimal sem separador de milhar", () => {
    expect(lerValorProDoctor("9876,54")).toBe("9876.54");
  });

  it("preserva todas as casas decimais, inteiros e negativos, como vêm da API", () => {
    expect(lerValorProDoctor("123,45678901234567")).toBe("123.45678901234567");
    expect(lerValorProDoctor("850")).toBe("850");
    expect(lerValorProDoctor("-12,3456")).toBe("-12.3456");
    expect(lerValorProDoctor("0")).toBe("0");
  });

  it("rejeita formato que não é do ProDoctor em vez de adivinhar (L8)", () => {
    for (const estranho of ["1.234,56", "1234.56", "12,3,4", "R$ 10,00", "abc", " 10,00", ",50", "10,", "--5"]) {
      expect(() => lerValorProDoctor(estranho), estranho).toThrow(/formato inesperado/);
    }
  });

  it("texto vazio ou ausente é 'não informado' (null), nunca zero", () => {
    expect(lerValorProDoctor("")).toBeNull();
    expect(lerValorProDoctor(null)).toBeNull();
    expect(lerValorProDoctor(undefined)).toBeNull();
  });
});

describe("compararValores", () => {
  it("ordena pelo valor exato, sem ponto flutuante, com casas e sinais diferentes", () => {
    const valores = ["10", "-0.5", "9.999", "0.1", "-12.3456", "10.00", "1234567890123456789.01", "0.30000000000000001"];
    expect([...valores].sort(compararValores)).toEqual([
      "-12.3456",
      "-0.5",
      "0.1",
      "0.30000000000000001",
      "9.999",
      "10",
      "10.00",
      "1234567890123456789.01",
    ]);
  });

  it("valores iguais com casas diferentes empatam", () => {
    expect(compararValores("10", "10.000")).toBe(0);
    expect(compararValores("-0", "0")).toBe(0);
  });
});
