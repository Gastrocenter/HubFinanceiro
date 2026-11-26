import { describe, expect, it } from "vitest";
import { montarTitulos, type LinhaDoTitulo } from "./montar-titulos";

const linha = (sobrescrever: Partial<LinhaDoTitulo>): LinhaDoTitulo => ({
  numeroRepasse: "8908", nomeProfissional: "Dra. Ana Teste", profissionalId: 7, dataRepasse: "2026-10-20", valorRepassadoMedico: "10",
  ...sobrescrever,
});

describe("montarTitulos", () => {
  it("um título por (profissional, lote), com o total exato e arredondado uma vez só (D-T)", () => {
    const titulos = montarTitulos([
      // Linha a linha: 88,24 + 88,24 = 176,48. No total: 176,488 → 176,49.
      linha({ valorRepassadoMedico: "88.244" }),
      linha({ valorRepassadoMedico: "88.244" }),
      linha({ nomeProfissional: "Dr. Bruno Teste", profissionalId: null, valorRepassadoMedico: "-0.0012" }),
      linha({ numeroRepasse: "9000", dataRepasse: "2026-10-29", valorRepassadoMedico: "0.1" }),
      linha({ numeroRepasse: "9000", dataRepasse: "2026-10-29", valorRepassadoMedico: "0.2" }),
    ]);
    expect(titulos).toEqual([
      { numeroRepasse: "8908", nomeProfissional: "Dra. Ana Teste", profissionalId: 7, dataRepasse: "2026-10-20", linhas: 2, totalExato: "176.488", totalCentavos: 17649n },
      { numeroRepasse: "8908", nomeProfissional: "Dr. Bruno Teste", profissionalId: null, dataRepasse: "2026-10-20", linhas: 1, totalExato: "-0.0012", totalCentavos: 0n },
      { numeroRepasse: "9000", nomeProfissional: "Dra. Ana Teste", profissionalId: 7, dataRepasse: "2026-10-29", linhas: 2, totalExato: "0.3", totalCentavos: 30n },
    ]);
  });

  it("recusa lote com mais de uma data e linha sem valor ao profissional", () => {
    expect(() => montarTitulos([linha({}), linha({ dataRepasse: "2026-10-21" })])).toThrow(/data/);
    expect(() => montarTitulos([linha({ valorRepassadoMedico: null })])).toThrow(/valorRepassadoMedico/);
  });
});
