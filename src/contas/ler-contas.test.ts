import { describe, expect, it } from "vitest";
import { lerContas } from "./ler-contas";

/** Linha sintética no formato real do ProDoctor (valores e nomes inventados). */
function linha(sobrescrever: Record<string, string> = {}) {
  return {
    codigoLocalProDoctor: "1", localProDoctor: "Unidade Teste", numero: "52001", dataInclusao: "2026-10-03",
    dataEfetivacao: "2026-10-05", dataVencimento: "2026-10-05", situacao: "PAGA", usuarioInclusao: "FUNCIONARIA FICTICIA",
    usuarioEfetivacao: "FUNCIONARIO FICTICIO", historico: "Compra de material", creditoValor: "0", creditoValorEfetivacao: "0",
    debitoValor: "1234,5", debitoValorEfetivacao: "1234,5", dataCompensacao: "", grupoReceitaDespesa: "2.01.03",
    nomeGrupoReceitaDespesa: "Material de consumo", formaEfetivacao: "PIX", banco: "001", agencia: "1234", contaCorrente: "99999-9",
    cheque: "", conta: "Caixa Teste", lancamentoFinanceiro: "7001", tipoClienteFornecedor: "Fornecedor",
    clienteFornecedor: "Fornecedor Teste Ltda", contaContabil: "2", nomeContaContabil: "Despesas", contaContabilEfetivacao: "2",
    nomeContaContabilEfetivacao: "Despesas", fatura: "", numRepasse: "", percentualTaxa: "", contaPagarReceberPai: "",
    numeroDocumento: "NF-123",
    ...sobrescrever,
  };
}
const pagina = (...linhas: unknown[]) => ({ payload: { exportacao: { registros: linhas, quantidade: linhas.length } }, message: null });

/** Conta a receber de paciente, com o nome dele no cliente e no histórico. */
const doPaciente = linha({
  numero: "52002", situacao: "RECEBIDA", tipoClienteFornecedor: "Paciente", clienteFornecedor: "PACIENTE FICTICIO DA SILVA",
  historico: "Recebimento PACIENTE FICTICIO DA SILVA", numeroDocumento: "900001", creditoValor: "350", creditoValorEfetivacao: "336,7",
  debitoValor: "0", debitoValorEfetivacao: "0", percentualTaxa: "3,8", formaEfetivacao: "Cartão de Crédito", fatura: "202610",
  grupoReceitaDespesa: "1.01.01", nomeGrupoReceitaDespesa: "Consultas particulares", contaContabil: "1", nomeContaContabil: "Receitas",
});

describe("lerContas", () => {
  it("lê a conta de fornecedor campo a campo, com valores exatos e datas vazias como nulas", () => {
    const [c] = lerContas(pagina(linha()));
    expect(c).toEqual({
      codigoLocal: "1", numero: "52001", lancamentoFinanceiro: "7001", contaPagarReceberPai: "",
      dataInclusao: "2026-10-03", dataEfetivacao: "2026-10-05", dataVencimento: "2026-10-05", dataCompensacao: null,
      situacao: "PAGA", tipoClienteFornecedor: "Fornecedor", clienteFornecedor: "Fornecedor Teste Ltda",
      historico: "Compra de material", numeroDocumento: "NF-123",
      creditoValor: "0", creditoValorEfetivacao: "0", debitoValor: "1234.5", debitoValorEfetivacao: "1234.5", percentualTaxa: null,
      grupoReceitaDespesa: "2.01.03", nomeGrupoReceitaDespesa: "Material de consumo", contaContabil: "2", nomeContaContabil: "Despesas",
      contaContabilEfetivacao: "2", nomeContaContabilEfetivacao: "Despesas", formaEfetivacao: "PIX", conta: "Caixa Teste",
      fatura: "", numRepasse: "",
    });
  });

  it("de paciente guarda só o tipo: sem nome, histórico nem número do documento (D-1)", () => {
    const [c] = lerContas(pagina(doPaciente));
    expect(c).toMatchObject({
      tipoClienteFornecedor: "Paciente", clienteFornecedor: null, historico: null, numeroDocumento: null,
      creditoValor: "350", creditoValorEfetivacao: "336.7", percentualTaxa: "3.8", fatura: "202610",
    });
  });

  it("só fornecedor, convênio e prestador guardam nome: tipo vazio ou com outra grafia fica sem nome (D-1, à prova de falha)", () => {
    for (const tipo of ["PACIENTE", "Paciente ", "", "Cliente"]) {
      const [c] = lerContas(pagina({ ...doPaciente, tipoClienteFornecedor: tipo }));
      expect({ nome: c.clienteFornecedor, historico: c.historico, documento: c.numeroDocumento }, JSON.stringify(tipo)).toEqual({
        nome: null, historico: null, documento: null,
      });
    }
    for (const tipo of ["Fornecedor", "Convênio", "Prestador de Serviço"]) {
      expect(lerContas(pagina(linha({ tipoClienteFornecedor: tipo })))[0].clienteFornecedor, tipo).toBe("Fornecedor Teste Ltda");
    }
  });

  it("não deixa sair dado de paciente, nome de funcionário nem dado bancário (ADR-0005, D-1)", () => {
    const contas = lerContas(pagina(linha(), doPaciente));
    const texto = JSON.stringify(contas);
    for (const proibido of ["PACIENTE FICTICIO", "900001", "FUNCIONARIA FICTICIA", "FUNCIONARIO FICTICIO", "99999-9", "1234\""]) {
      expect(texto, proibido).not.toContain(proibido);
    }
    for (const campo of ["usuarioInclusao", "usuarioEfetivacao", "banco", "agencia", "contaCorrente", "cheque", "localProDoctor"]) {
      expect(contas[0], campo).not.toHaveProperty(campo);
    }
  });

  it("rejeita chave, data ou valor fora do formato", () => {
    expect(() => lerContas(pagina(linha({ numero: "" })))).toThrow(/numero/);
    expect(() => lerContas(pagina(linha({ codigoLocalProDoctor: "" })))).toThrow(/codigoLocalProDoctor/);
    expect(() => lerContas(pagina(linha({ dataInclusao: "03/10/2026" })))).toThrow(/dataInclusao/);
    expect(() => lerContas(pagina(linha({ dataInclusao: "" })))).toThrow(/dataInclusao/);
    expect(() => lerContas(pagina(linha({ debitoValor: "1.234,56" })))).toThrow(/formato inesperado/);
  });
});
