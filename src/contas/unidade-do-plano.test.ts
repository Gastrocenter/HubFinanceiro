import { describe, expect, it } from "vitest";
import { itemSemUnidade, unidadeDoPlano } from "./unidade-do-plano";

describe("unidadeDoPlano", () => {
  it("raiz 1 (Stella Central) e raiz 3 (TNI) caem em Stella Central", () => {
    expect(unidadeDoPlano("1.02.008.0005")).toBe("stella");
    expect(unidadeDoPlano("3.01.001.0002")).toBe("stella");
  });

  it("raiz 2 cai em Albert Sabin", () => {
    expect(unidadeDoPlano("2.02.008.0005")).toBe("sabin");
  });

  it("raiz 0 (abertura e fechamento de caixa) fica só em Todas", () => {
    expect(unidadeDoPlano("0.01.001")).toBe("caixa");
  });

  it("conta lançada direto num grupo, sem item, segue a raiz", () => {
    expect(unidadeDoPlano("1.01.001")).toBe("stella");
  });

  it("raiz desconhecida, código vazio ou ausente cai em caixa", () => {
    expect(unidadeDoPlano("4.01.001.0001")).toBe("caixa");
    expect(unidadeDoPlano("12.01.001")).toBe("caixa");
    expect(unidadeDoPlano("")).toBe("caixa");
    expect(unidadeDoPlano(null)).toBe("caixa");
  });

  it("tolera espaços em volta do código", () => {
    expect(unidadeDoPlano("  2.02.008.0005 ")).toBe("sabin");
  });
});

describe("itemSemUnidade", () => {
  it("tira o sufixo da unidade, para o mesmo item das três raízes cair na mesma categoria", () => {
    expect(itemSemUnidade("Taxa de Cartão sobre a Venda (STELLA)")).toBe("Taxa de Cartão sobre a Venda");
    expect(itemSemUnidade("Taxa de Cartão sobre a Venda (SABIN)")).toBe("Taxa de Cartão sobre a Venda");
    expect(itemSemUnidade("Taxa de Cartão sobre a Venda (TNI)")).toBe("Taxa de Cartão sobre a Venda");
  });

  it("tolera caixa e espaços no sufixo", () => {
    expect(itemSemUnidade("ISSQN ( Stella )  ")).toBe("ISSQN");
    expect(itemSemUnidade("ISSQN(sabin)")).toBe("ISSQN");
    expect(itemSemUnidade("  ISSQN   (Tni)")).toBe("ISSQN");
  });

  it("só tira o sufixo do fim, não o que aparece no meio", () => {
    expect(itemSemUnidade("Repasse (TNI) sobre Venda")).toBe("Repasse (TNI) sobre Venda");
    expect(itemSemUnidade("Repasse TNI (STELLA)")).toBe("Repasse TNI");
  });

  it("tira todos os sufixos de unidade do fim: o resultado não muda se aplicar de novo", () => {
    expect(itemSemUnidade("Repasse (TNI) (STELLA)")).toBe("Repasse");
    expect(itemSemUnidade(itemSemUnidade("Foo (TNI) (SABIN)"))).toBe(itemSemUnidade("Foo (TNI) (SABIN)"));
  });

  it("não mexe em parênteses que não são unidade", () => {
    expect(itemSemUnidade("Manometria (esofágica)")).toBe("Manometria (esofágica)");
  });

  it("sem sufixo, só apara os espaços", () => {
    expect(itemSemUnidade("  Aluguel de Sala ")).toBe("Aluguel de Sala");
  });
});
