import { describe, expect, it } from "vitest";
import { chaveDaConta, diferencaDoMesDeContas } from "./diferenca-do-mes-de-contas";
import type { RegistroDeConta } from "./ler-contas";

function conta(numero: string, sobrescrever: Partial<RegistroDeConta> = {}): RegistroDeConta {
  return {
    codigoLocal: "1", numero, lancamentoFinanceiro: "7001", contaPagarReceberPai: "", dataInclusao: "2026-10-03",
    dataEfetivacao: null, dataVencimento: "2026-10-20", dataCompensacao: null, situacao: "PAGAR", tipoClienteFornecedor: "Fornecedor",
    clienteFornecedor: "Fornecedor Teste", historico: "Material", numeroDocumento: "", creditoValor: "0", creditoValorEfetivacao: "0",
    debitoValor: "100", debitoValorEfetivacao: "0", percentualTaxa: null, grupoReceitaDespesa: "2.01", nomeGrupoReceitaDespesa: "Material",
    contaContabil: "2", nomeContaContabil: "Despesas", contaContabilEfetivacao: "", nomeContaContabilEfetivacao: "", formaEfetivacao: "",
    conta: "", fatura: "", numRepasse: "",
    ...sobrescrever,
  };
}
const atual = (r: RegistroDeConta, visto = true) => ({ registro: r, vistoNaUltimaSync: visto });

describe("diferencaDoMesDeContas", () => {
  it("a chave é unidade + número", () => {
    expect(chaveDaConta(conta("52001"))).toBe("1:52001");
  });

  it("conta nova entra, conta paga traz os campos que mudaram, conta excluída some e a que voltou é marcada", () => {
    const aPagar = conta("52001");
    const paga = conta("52001", { situacao: "PAGA", dataEfetivacao: "2026-10-21", debitoValorEfetivacao: "100" });
    const excluida = conta("52002");
    const voltou = conta("52003");
    const nova = conta("52004");

    expect(diferencaDoMesDeContas([atual(aPagar), atual(excluida), atual(voltou, false)], [paga, voltou, nova])).toEqual({
      novos: [nova],
      alterados: [{ registro: paga, campos: ["dataEfetivacao", "situacao", "debitoValorEfetivacao"] }],
      sumiram: ["1:52002"],
      voltaram: ["1:52003"],
    });
  });
});
