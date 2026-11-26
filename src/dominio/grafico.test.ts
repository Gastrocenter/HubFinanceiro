import { describe, expect, it } from "vitest";
import { alturasDasBarras } from "./grafico";

describe("alturasDasBarras", () => {
  it("o maior valor ocupa a altura toda e os outros são proporcionais", () => {
    expect(alturasDasBarras(["200.00", "100.00", "50.00"])).toEqual([1000, 500, 250]);
  });

  it("compara valores exatos com muitas casas sem ponto flutuante", () => {
    expect(alturasDasBarras(["0.30000000000001", "0.1"])).toEqual([1000, 333]);
  });

  it("valor negativo ou zero não tem barra", () => {
    expect(alturasDasBarras(["-10.00", "0", "10.00"])).toEqual([0, 0, 1000]);
  });

  it("valor positivo muito menor que o maior ainda aparece", () => {
    expect(alturasDasBarras(["1000000.00", "0.01"])).toEqual([1000, 1]);
  });

  it("tudo zero ou lista vazia não divide por zero", () => {
    expect(alturasDasBarras(["0", "0.00"])).toEqual([0, 0]);
    expect(alturasDasBarras([])).toEqual([]);
  });
});
