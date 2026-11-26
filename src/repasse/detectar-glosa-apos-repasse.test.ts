import { describe, expect, it } from "vitest";
import { detectarGlosaAposRepasse } from "./detectar-glosa-apos-repasse";
import type { RegistroDeProcedimento } from "@/receita/ler-procedimentos";

function proc(conta: string, sobrescrever: Partial<RegistroDeProcedimento> = {}): RegistroDeProcedimento {
  return {
    codigoLocal: "1", conta, linha: "1", fatura: "100", data: "2026-08-10",
    nomeProfissional: "Dra. Ana Teste", nomeConvenio: "Plano Teste", especialidade: "Gastro", funcao: "", funcaoRepasse: "",
    codigoProcedimento: "1", descricaoProcedimento: "Consulta", tipoProcedimento: "Consulta", grupoProcedimentosRepasses: "",
    quantidade: "1", valorTotal: "100", valorDiferenca: null, valorGlosa: null, valorRecuperado: null,
    totalMateriaisMedicamentos: "0", totalTaxasDiarias: "0", totalGlosasMateriaisMedicamentos: "0", totalGlosasTaxasDiarias: "0",
    totalRecuperadoMateriaisMedicamentos: "0", totalRecuperadoTaxasDiarias: "0",
    naoRepassar: false, somenteRepasse: false, naoIncluirRepasse: false,
    ...sobrescrever,
  };
}
const repasse = { numeroRepasse: "8908", dataRepasse: "2026-10-20", valorRepassadoMedico: "82" };

describe("detectarGlosaAposRepasse", () => {
  it("glosa nova ou alterada em procedimento já repassado vira pendência com os valores (D-V)", () => {
    const repassados = new Map([["1:A:1", [repasse]], ["1:B:1", [repasse]]]);
    const pendencias = detectarGlosaAposRepasse(
      [
        { antes: proc("A"), depois: proc("A", { valorGlosa: "30" }) }, // glosa nova
        { antes: proc("B", { totalGlosasTaxasDiarias: "5" }), depois: proc("B", { totalGlosasTaxasDiarias: "7.5" }) }, // alterada
        { antes: proc("C"), depois: proc("C", { valorGlosa: "30" }) }, // sem repasse: não é com o repasse
      ],
      repassados,
    );
    expect(pendencias).toEqual([
      {
        referencia: "1:A:1|valorGlosa=30",
        detalhes: { procedimento: "1:A:1", repasses: [repasse], glosa: { valorGlosa: { antes: null, depois: "30" } } },
      },
      {
        referencia: "1:B:1|totalGlosasTaxasDiarias=7.5",
        detalhes: { procedimento: "1:B:1", repasses: [repasse], glosa: { totalGlosasTaxasDiarias: { antes: "5", depois: "7.5" } } },
      },
    ]);
  });

  it("a glosa mudar de novo gera outra referência: a pendência aberta da primeira mudança não engole a segunda", () => {
    const repassados = new Map([["1:A:1", [repasse]]]);
    const [primeira] = detectarGlosaAposRepasse([{ antes: proc("A"), depois: proc("A", { valorGlosa: "30" }) }], repassados);
    const [segunda] = detectarGlosaAposRepasse([{ antes: proc("A", { valorGlosa: "30" }), depois: proc("A", { valorGlosa: "45.00" }) }], repassados);
    expect(segunda.referencia).toBe("1:A:1|valorGlosa=45");
    expect(segunda.referencia).not.toBe(primeira.referencia);
  });

  it("procedimento repassado em dois lotes: a pendência traz os dois repasses", () => {
    const refeito = { numeroRepasse: "8999", dataRepasse: "2026-11-20", valorRepassadoMedico: "0" };
    const [pendencia] = detectarGlosaAposRepasse(
      [{ antes: proc("A"), depois: proc("A", { valorGlosa: "30" }) }],
      new Map([["1:A:1", [repasse, refeito]]]),
    );
    expect(pendencia.detalhes.repasses).toEqual([repasse, refeito]);
  });

  it("mudança que não é de glosa, ou só de grafia (vazio ↔ 0, 30 ↔ 30.00), não gera pendência", () => {
    const repassados = new Map([["1:A:1", [repasse]]]);
    expect(
      detectarGlosaAposRepasse(
        [
          { antes: proc("A", { valorGlosa: null }), depois: proc("A", { valorGlosa: "0", descricaoProcedimento: "Outra" }) },
          { antes: proc("A", { valorGlosa: "30" }), depois: proc("A", { valorGlosa: "30.00" }) },
        ],
        repassados,
      ),
    ).toEqual([]);
  });
});
