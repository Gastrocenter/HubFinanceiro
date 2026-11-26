import { describe, expect, it } from "vitest";
import { lerRepasses } from "./ler-repasses";

/** Linha sintética no formato real do ProDoctor (valores e nomes inventados). */
function linha(sobrescrever: Record<string, string> = {}) {
  return {
    codigoLocalProDoctor: "1", localProDoctor: "Unidade Teste", dataRepasse: "2026-10-20", numeroRepasse: "8908",
    fatura: "202608", tipo: "Repasse", conta: "300400", linha: "2", data: "2026-08-13", nomeConvenio: "Plano Teste",
    percentualImposto: "18 %", prontuario: "900001", nomePaciente: "PACIENTE FICTICIO DA SILVA", nomeUsuario: "Dra. Ana Teste",
    codigoAmb: "1.01.01.01-2", descricaoAmb: "Consulta", funcaoRepasse: "",
    totalConta: "110,31", baseCalculoBruto: "107,62049999999999", valorImposto: "19,3717", baseCalculoLiquido: "88,24879999999999",
    valorRepassado: "88,25", valorRepassadoMedico: "88,25", valorRepassadoClinica: "-0,00120000000001",
    ...sobrescrever,
  };
}
const pagina = (...linhas: unknown[]) => ({ payload: { exportacao: { registros: linhas } }, message: null });

describe("lerRepasses", () => {
  it("lê chave do procedimento, lote, datas, nomes, valores exatos e o percentual de imposto como número", () => {
    const [r] = lerRepasses(pagina(linha()));
    expect(r).toEqual({
      codigoLocal: "1", conta: "300400", linha: "2", numeroRepasse: "8908", dataRepasse: "2026-10-20", data: "2026-08-13",
      fatura: "202608", tipo: "Repasse", nomeProfissional: "Dra. Ana Teste", nomeConvenio: "Plano Teste",
      codigoProcedimento: "1.01.01.01-2", descricaoProcedimento: "Consulta", funcaoRepasse: "",
      percentualImposto: "18", totalConta: "110.31", baseCalculoBruto: "107.62049999999999", valorImposto: "19.3717",
      baseCalculoLiquido: "88.24879999999999", valorRepassado: "88.25", valorRepassadoMedico: "88.25",
      valorRepassadoClinica: "-0.00120000000001",
    });
  });

  it("aceita imposto 0 % e rejeita percentual, data, chave ou valor fora do formato", () => {
    expect(lerRepasses(pagina(linha({ percentualImposto: "0 %" })))[0].percentualImposto).toBe("0");
    expect(() => lerRepasses(pagina(linha({ percentualImposto: "18" })))).toThrow(/percentualImposto/);
    expect(() => lerRepasses(pagina(linha({ dataRepasse: "20/10/2026" })))).toThrow(/dataRepasse/);
    expect(() => lerRepasses(pagina(linha({ numeroRepasse: "" })))).toThrow(/numeroRepasse/);
    expect(() => lerRepasses(pagina(linha({ conta: "" })))).toThrow(/conta/);
    expect(() => lerRepasses(pagina(linha({ valorRepassadoMedico: "1.234,56" })))).toThrow(/formato inesperado/);
  });

  it("não deixa sair nenhum dado de paciente (ADR-0005)", () => {
    const [r] = lerRepasses(pagina(linha()));
    for (const campo of ["nomePaciente", "prontuario"]) expect(r, campo).not.toHaveProperty(campo);
    const texto = JSON.stringify(r);
    for (const dadoDoPaciente of ["PACIENTE FICTICIO", "900001"]) expect(texto, dadoDoPaciente).not.toContain(dadoDoPaciente);
  });
});
