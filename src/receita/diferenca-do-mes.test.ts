import { describe, expect, it } from "vitest";
import { chaveDoProcedimento, diferencaDoMes, type ProcedimentoAtual } from "./diferenca-do-mes";
import type { RegistroDeProcedimento } from "./ler-procedimentos";

function proc(conta: string, sobrescrever: Partial<RegistroDeProcedimento> = {}): RegistroDeProcedimento {
  return {
    codigoLocal: "1", conta, linha: "1", fatura: "100", data: "2026-10-10",
    nomeProfissional: "Dra. Ana Teste", nomeConvenio: "Plano Teste", especialidade: "Gastro", funcao: "Cirurgião", funcaoRepasse: "1",
    codigoProcedimento: "1", descricaoProcedimento: "Consulta", tipoProcedimento: "Consulta", grupoProcedimentosRepasses: "",
    quantidade: "1", valorTotal: "100", valorDiferenca: null, valorGlosa: null, valorRecuperado: null,
    totalMateriaisMedicamentos: "0", totalTaxasDiarias: "0", totalGlosasMateriaisMedicamentos: "0", totalGlosasTaxasDiarias: "0",
    totalRecuperadoMateriaisMedicamentos: "0", totalRecuperadoTaxasDiarias: "0",
    naoRepassar: false, somenteRepasse: false, naoIncluirRepasse: false,
    ...sobrescrever,
  };
}
const atual = (p: RegistroDeProcedimento, visto = true): ProcedimentoAtual => ({ registro: p, vistoNaUltimaSync: visto });
const vazio = { novos: [], alterados: [], sumiram: [], voltaram: [] };

describe("diferencaDoMes", () => {
  it("traz linhas novas e alteradas (com os campos que mudaram); igual não gera nada", () => {
    const a = proc("A");
    const b = proc("B");
    const bComGlosa = proc("B", { valorGlosa: "30" });
    const c = proc("C");

    expect(diferencaDoMes([atual(a), atual(b)], [a, bComGlosa, c])).toEqual({
      ...vazio,
      novos: [c],
      alterados: [{ registro: bComGlosa, campos: ["valorGlosa"] }],
    });
    expect(diferencaDoMes([atual(a), atual(b)], [a, b])).toEqual(vazio);
  });

  it("marca o que sumiu do mês (L3) e o que voltou; quem já estava sumido não entra de novo", () => {
    const [a, b, c, d] = ["A", "B", "C", "D"].map((x) => proc(x));
    const diferenca = diferencaDoMes([atual(a), atual(b), atual(c, false), atual(d, false)], [a, c]);
    expect(diferenca).toEqual({ ...vazio, sumiram: [chaveDoProcedimento(b)], voltaram: [chaveDoProcedimento(c)] });
  });

  it("procedimento repetido entre páginas entra uma vez só, com a última versão", () => {
    const primeira = proc("A", { valorGlosa: null });
    const ultima = proc("A", { valorGlosa: "10" });
    const diferenca = diferencaDoMes([], [primeira, proc("B"), ultima]);
    expect(diferenca.novos.map(chaveDoProcedimento)).toEqual([chaveDoProcedimento(proc("B")), chaveDoProcedimento(ultima)]);
    expect(diferenca.novos.find((p) => p.conta === "A")?.valorGlosa).toBe("10");
  });

  it("recusa mês que veio vazio quando o Hub já tem procedimentos nele", () => {
    expect(() => diferencaDoMes([atual(proc("A"))], [])).toThrow(/vazio/);
    expect(diferencaDoMes([], [])).toEqual(vazio);
  });
});

describe("chaveDoProcedimento", () => {
  it("é (unidade, conta, linha), sem a fatura (D-N)", () => {
    expect(chaveDoProcedimento(proc("A"))).toBe(chaveDoProcedimento(proc("A", { fatura: "999" })));
    expect(chaveDoProcedimento(proc("A"))).not.toBe(chaveDoProcedimento(proc("A", { linha: "2" })));
  });
});
