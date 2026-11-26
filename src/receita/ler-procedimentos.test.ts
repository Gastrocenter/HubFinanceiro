import { describe, expect, it } from "vitest";
import { lerProcedimentos } from "./ler-procedimentos";

/** Linha sintética no formato real do ProDoctor (valores e nomes inventados). */
function linha(sobrescrever: Record<string, string> = {}) {
  return {
    codigoLocalProDoctor: "1", localProDoctor: "Unidade Teste",
    paciente: "PACIENTE FICTICIO DA SILVA", prontuario: "900001", numeroMatricula: "123456789", guia: "555", numeroGuiaOperadora: "777",
    convenio: "Plano Teste", fatura: "100200", conta: "300400", linhaProcedimento: "2", data: "2026-10-15",
    usuario: "Dra. Ana Teste", funcao: "Cirurgião", funcaoRepasse: "12", usuarioEspecialidade: "Gastro",
    codigoProcedimento: "40201120", descricaoProcedimento: "Endoscopia", tipoProcedimento: "Exame",
    grupoProcedimentosRepasses: "G1", quantidade: "1", valorTotal: "450,75", valorDiferenca: "", valorGlosa: "50", valorRecuperado: "",
    totalMateriaisMedicamentos: "0", totalTaxasDiarias: "120,5", totalGlosasMateriaisMedicamentos: "0", totalGlosasTaxasDiarias: "0",
    totalRecuperadoMateriaisMedicamentos: "0", totalRecuperadoTaxasDiarias: "0",
    naoRepassar: "Não", somenteRepasse: "Não", naoIncluirRepasse: "Sim", solicitante: "Dr. Solicitante Teste",
    ...sobrescrever,
  };
}
const pagina = (...linhas: unknown[]) => ({ payload: { exportacao: { registros: linhas } }, message: null });

describe("lerProcedimentos", () => {
  it("lê chave, data, nomes, valores exatos e flags de repasse", () => {
    const [p] = lerProcedimentos(pagina(linha()));
    expect(p).toMatchObject({
      codigoLocal: "1", conta: "300400", linha: "2", fatura: "100200", data: "2026-10-15",
      nomeProfissional: "Dra. Ana Teste", nomeConvenio: "Plano Teste", especialidade: "Gastro",
      codigoProcedimento: "40201120", quantidade: "1",
      valorTotal: "450.75", valorGlosa: "50", valorRecuperado: null, valorDiferenca: null, totalTaxasDiarias: "120.5",
      naoRepassar: false, somenteRepasse: false, naoIncluirRepasse: true,
    });
  });

  it("rejeita flag desconhecida, chave ausente e data fora do formato", () => {
    expect(() => lerProcedimentos(pagina(linha({ naoIncluirRepasse: "S" })))).toThrow(/naoIncluirRepasse/);
    expect(() => lerProcedimentos(pagina(linha({ conta: "" })))).toThrow(/conta/);
    expect(() => lerProcedimentos(pagina(linha({ linhaProcedimento: "" })))).toThrow(/linhaProcedimento/);
    expect(() => lerProcedimentos(pagina(linha({ data: "15/10/2026" })))).toThrow(/data/);
    expect(() => lerProcedimentos(pagina(linha({ valorTotal: "1.234,56" })))).toThrow(/formato inesperado/);
  });

  it("não deixa sair nenhum dado de paciente (ADR-0005)", () => {
    const [p] = lerProcedimentos(pagina(linha()));
    for (const campo of ["paciente", "prontuario", "numeroMatricula", "guia", "numeroGuiaOperadora"]) {
      expect(p, campo).not.toHaveProperty(campo);
    }
    const texto = JSON.stringify(p);
    for (const dadoDoPaciente of ["PACIENTE FICTICIO", "900001", "123456789", "555", "777"]) {
      expect(texto, dadoDoPaciente).not.toContain(dadoDoPaciente);
    }
  });
});
