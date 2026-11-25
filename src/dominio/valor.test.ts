import { describe, expect, it } from "vitest";
import { lerValorProDoctor } from "./valor";

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
