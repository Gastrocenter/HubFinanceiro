import { describe, expect, it } from "vitest";
import { classificarPendencia } from "./classificar-pendencia";

describe("classificarPendencia", () => {
  it("procedimento e repasse que sumiram são 'excluído' e apontam para o registro no mês", () => {
    expect(classificarPendencia({ tipo: "procedimento_sumiu", referencia: "1:4521:2", detalhes: { mes: "2026-10" } })).toEqual({
      categoria: "excluido",
      origem: { texto: "Unidade 1, conta 4521, linha 2", link: "/receita?mes=2026-10" },
      resolveAMao: true,
    });
    expect(classificarPendencia({ tipo: "repasse_sumiu", referencia: "1:4521:2:8908", detalhes: { mes: "2026-10" } })).toEqual({
      categoria: "excluido",
      origem: { texto: "Unidade 1, conta 4521, linha 2, lote 8908", link: "/repasses?mes=2026-10" },
      resolveAMao: true,
    });
  });

  it("conta a pagar/receber que sumiu é 'excluído' e aponta para as contas do mês de vencimento (issue 08b)", () => {
    expect(
      classificarPendencia({ tipo: "conta_sumiu", referencia: "1:52001", detalhes: { mes: "2026-10", vencimento: "2026-11-05", situacao: "PAGAR" } }),
    ).toEqual({
      categoria: "excluido",
      origem: { texto: "Unidade 1, conta a pagar nº 52001", link: "/contas/pagar?aba=todas&de=2026-11-01&ate=2026-11-30" },
      resolveAMao: true,
    });
    // A receber vai para a página a receber (issue 11): a página antiga mostrava as duas.
    expect(
      classificarPendencia({ tipo: "conta_sumiu", referencia: "1:9", detalhes: { vencimento: "2026-02-10", situacao: "RECEBIDA" } }).origem,
    ).toEqual({ texto: "Unidade 1, conta a receber nº 9", link: "/contas/receber?aba=todas&de=2026-02-01&ate=2026-02-28" });
    expect(classificarPendencia({ tipo: "conta_sumiu", referencia: "1:52001", detalhes: { mes: "2026-10" } }).origem.link).toBe("/contas/pagar?aba=todas");
  });

  it("repasse sem procedimento aponta para o lote no mês do repasse", () => {
    expect(
      classificarPendencia({
        tipo: "repasse_sem_procedimento",
        referencia: "1:4521:2",
        detalhes: { mes: "2026-10", data: "2026-08-03", numero_repasse: "8908" },
      }),
    ).toEqual({
      categoria: "repasse",
      origem: { texto: "Unidade 1, conta 4521, linha 2, lote 8908", link: "/repasses?mes=2026-10" },
      resolveAMao: true,
    });
  });

  it("glosa após repasse aponta para o procedimento e os lotes, no mês do primeiro repasse", () => {
    expect(
      classificarPendencia({
        tipo: "glosa_apos_repasse",
        referencia: "1:4521:2|valorGlosa=30",
        detalhes: {
          procedimento: "1:4521:2",
          repasses: [
            { numeroRepasse: "8908", dataRepasse: "2026-10-20", valorRepassadoMedico: "82" },
            { numeroRepasse: "8999", dataRepasse: "2026-11-20", valorRepassadoMedico: "0" },
          ],
          glosa: { valorGlosa: { antes: null, depois: "30" } },
        },
      }),
    ).toEqual({
      categoria: "glosa",
      origem: { texto: "Unidade 1, conta 4521, linha 2, lotes 8908 e 8999", link: "/repasses?mes=2026-10" },
      resolveAMao: true,
    });
  });

  it("de-para aponta para os cadastros e não se resolve à mão (D-C)", () => {
    expect(classificarPendencia({ tipo: "profissional_sem_par", referencia: "Dra. Ana Teste", detalhes: { mes: "2026-10" } })).toEqual({
      categoria: "de_para",
      origem: { texto: "Profissional “Dra. Ana Teste”", link: "/cadastros" },
      resolveAMao: false,
    });
    expect(classificarPendencia({ tipo: "convenio_ambiguo", referencia: "Plano Teste", detalhes: {} }).origem.texto).toBe(
      "Convênio “Plano Teste”",
    );
    expect(classificarPendencia({ tipo: "unidade_sem_par", referencia: "7", detalhes: {} })).toMatchObject({
      categoria: "de_para",
      origem: { texto: "Unidade de código 7", link: "/cadastros" },
      resolveAMao: false,
    });
  });

  it("item sem categoria aponta para Cadastros → Categorias e não se resolve à mão (issue 11, D-5)", () => {
    expect(
      classificarPendencia({ tipo: "item_sem_categoria", referencia: "pagar:Frete de Compra", detalhes: { natureza: "pagar", item: "Frete de Compra" } }),
    ).toEqual({
      categoria: "de_para",
      origem: { texto: "Item “Frete de Compra” (a pagar) sem categoria", link: "/cadastros/categorias?natureza=pagar" },
      resolveAMao: false,
    });
    expect(
      classificarPendencia({ tipo: "item_sem_categoria", referencia: "receber:CPRE", detalhes: { natureza: "receber", item: "CPRE" } }).origem,
    ).toEqual({ texto: "Item “CPRE” (a receber) sem categoria", link: "/cadastros/categorias?natureza=receber" });
  });

  it("todo tipo que o Hub cria tem tratamento próprio (nenhum cai em 'outra')", () => {
    const tipos = [
      "procedimento_sumiu", "repasse_sumiu", "repasse_sem_procedimento", "glosa_apos_repasse", "conta_sumiu", "item_sem_categoria",
      "unidade_sem_par", "profissional_sem_par", "profissional_ambiguo", "convenio_sem_par", "convenio_ambiguo",
    ];
    for (const tipo of tipos) {
      expect(classificarPendencia({ tipo, referencia: "1:A:1", detalhes: {} }).categoria, tipo).not.toBe("outra");
    }
  });

  it("um cadastro novo sem par ou ambíguo também é de-para e não se resolve à mão (D-C)", () => {
    expect(classificarPendencia({ tipo: "especialidade_sem_par", referencia: "Gastro", detalhes: {} })).toEqual({
      categoria: "de_para",
      origem: { texto: "especialidade “Gastro”", link: "/cadastros" },
      resolveAMao: false,
    });
  });

  it("tipo que o painel não conhece aparece como 'outra', com a referência crua e sem link", () => {
    expect(classificarPendencia({ tipo: "tipo_novo", referencia: "X:1", detalhes: {} })).toEqual({
      categoria: "outra",
      origem: { texto: "X:1", link: null },
      resolveAMao: true,
    });
  });
});
