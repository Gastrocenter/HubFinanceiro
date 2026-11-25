import { describe, expect, it } from "vitest";
import { parseBRLEmCentavos } from "./dinheiro";

describe("parseBRLEmCentavos", () => {
  it("converte valores pt-BR em centavos", () => {
    expect(parseBRLEmCentavos("1.234,56")).toBe(123456);
    expect(parseBRLEmCentavos("0,99")).toBe(99);
    expect(parseBRLEmCentavos("-10,00")).toBe(-1000);
  });
  it("rejeita valores ambíguos", () => {
    expect(() => parseBRLEmCentavos("1234.56")).toThrow();
    expect(() => parseBRLEmCentavos("1,234")).toThrow();
    expect(() => parseBRLEmCentavos("abc")).toThrow();
  });
});
