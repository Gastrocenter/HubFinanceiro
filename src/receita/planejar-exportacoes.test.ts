import { describe, expect, it } from "vitest";
import { mesesAteHoje, periodoDoMes } from "./planejar-exportacoes";

describe("mesesAteHoje", () => {
  it("janela diária: o mês atual e os 2 anteriores, atravessando a virada do ano", () => {
    expect(mesesAteHoje("2026-11-26", 3)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(mesesAteHoje("2027-01-05", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
  it("carga inicial: 12 meses terminando no atual", () => {
    const meses = mesesAteHoje("2026-11-26", 12);
    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe("2025-12");
    expect(meses.at(-1)).toBe("2026-11");
  });
});

describe("periodoDoMes", () => {
  it("vai do dia 1 ao último dia, no formato dd/mm/aaaa da API", () => {
    expect(periodoDoMes("2026-10")).toEqual({ dataInicial: "01/10/2026", dataFinal: "31/10/2026" });
    expect(periodoDoMes("2026-11")).toEqual({ dataInicial: "01/11/2026", dataFinal: "30/11/2026" });
    expect(periodoDoMes("2027-02")).toEqual({ dataInicial: "01/02/2027", dataFinal: "28/02/2027" });
    expect(periodoDoMes("2028-02")).toEqual({ dataInicial: "01/02/2028", dataFinal: "29/02/2028" });
  });
});
