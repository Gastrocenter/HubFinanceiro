import { describe, expect, it } from "vitest";
import { formatarReais } from "./formatar-reais";

describe("formatarReais", () => {
  it("formata no padrão brasileiro com milhar e centavos", () => {
    expect(formatarReais("566865.90")).toBe("R$ 566.865,90");
    expect(formatarReais("1234.5")).toBe("R$ 1.234,50");
    expect(formatarReais("0")).toBe("R$ 0,00");
    expect(formatarReais("1000000")).toBe("R$ 1.000.000,00");
  });

  it("arredonda meio para cima (D-D), a partir do texto exato, sem ponto flutuante", () => {
    expect(formatarReais("0.005")).toBe("R$ 0,01");
    expect(formatarReais("0.0049999999")).toBe("R$ 0,00");
    expect(formatarReais("123.45678901234567")).toBe("R$ 123,46");
    expect(formatarReais("1.015")).toBe("R$ 1,02"); // em float, 1.015 vira 1.01
    expect(formatarReais("-12.3456")).toBe("-R$ 12,35");
  });

  it("valor não informado aparece como traço", () => {
    expect(formatarReais(null)).toBe("—");
  });
});
