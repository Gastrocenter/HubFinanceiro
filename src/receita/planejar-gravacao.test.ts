import { describe, expect, it } from "vitest";
import { chaveDoProcedimento, diferencaDoMes } from "./diferenca-do-mes";
import type { RegistroDeProcedimento } from "./ler-procedimentos";
import { planejarGravacao, type Vinculos } from "./planejar-gravacao";

function proc(conta: string, nomeProfissional = "Dra. Ana Teste"): RegistroDeProcedimento {
  return {
    codigoLocal: "1", conta, linha: "1", fatura: "100", data: "2026-10-10",
    nomeProfissional, nomeConvenio: "Plano Teste", especialidade: "Médico teste", funcao: "Clínico", funcaoRepasse: "",
    codigoProcedimento: "1", descricaoProcedimento: "Consulta", tipoProcedimento: "Consulta", grupoProcedimentosRepasses: "",
    quantidade: "1", valorTotal: "100", valorDiferenca: null, valorGlosa: null, valorRecuperado: null,
    totalMateriaisMedicamentos: "0", totalTaxasDiarias: "0", totalGlosasMateriaisMedicamentos: "0", totalGlosasTaxasDiarias: "0",
    totalRecuperadoMateriaisMedicamentos: "0", totalRecuperadoTaxasDiarias: "0",
    naoRepassar: false, somenteRepasse: false, naoIncluirRepasse: false,
  };
}
const ligado: Vinculos = { unidade_id: 1, profissional_id: 7, convenio_id: 3 };
const semProfissional: Vinculos = { ...ligado, profissional_id: null };

describe("planejarGravacao", () => {
  it("religa a linha que não mudou no ProDoctor quando o cadastro passou a existir", () => {
    const a = proc("A");
    const b = proc("B");
    const atuais = [a, b].map((registro) => ({ registro, vistoNaUltimaSync: true }));
    const vinculosAtuais = new Map([[chaveDoProcedimento(a), semProfissional], [chaveDoProcedimento(b), ligado]]);

    const plano = planejarGravacao({ vindos: [a, b], diferenca: diferencaDoMes(atuais, [a, b]), vinculosAtuais, vincular: () => ligado });

    expect(plano.map((g) => chaveDoProcedimento(g.registro))).toEqual([chaveDoProcedimento(a)]);
    expect(plano[0].vinculos).toEqual(ligado);
  });

  it("linha nova sempre entra; linha igual com os mesmos vínculos não", () => {
    const a = proc("A");
    const novo = proc("N");
    const atuais = [{ registro: a, vistoNaUltimaSync: true }];
    const plano = planejarGravacao({
      vindos: [a, novo],
      diferenca: diferencaDoMes(atuais, [a, novo]),
      vinculosAtuais: new Map([[chaveDoProcedimento(a), ligado]]),
      vincular: () => ligado,
    });
    expect(plano.map((g) => g.registro.conta)).toEqual(["N"]);
  });
});
