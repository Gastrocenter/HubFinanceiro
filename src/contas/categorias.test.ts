import { describe, expect, it } from "vitest";
import { lerNatureza, slugDaCategoria, montarItens, validarNomeDeCategoria, validarTrocaDeCategoria } from "./categorias";

describe("montarItens", () => {
  const categorias = [
    { id: 1, natureza: "pagar" as const, nome: "Imposto" },
    { id: 2, natureza: "pagar" as const, nome: "Taxa de cartão" },
  ];

  it("põe o nome da categoria, as unidades por extenso e os sem categoria primeiro", () => {
    const { linhas, resumo } = montarItens(
      [
        { item: "IPTU", raizes: ["1", "2"], no_plano: true, contas: 4, categoria_id: 1 },
        { item: "Frete de Compra", raizes: ["1"], no_plano: true, contas: 0, categoria_id: null },
        { item: "IRPF", raizes: ["1", "2", "3"], no_plano: true, contas: 7, categoria_id: null },
        { item: "Taxa de Cartão sobre a Venda", raizes: ["3", "1"], no_plano: true, contas: 30, categoria_id: 2 },
      ],
      categorias,
    );
    expect(linhas.map((l) => [l.item, l.categoria, l.unidades])).toEqual([
      ["IRPF", null, "Stella Central, Albert Sabin, TNI"],
      ["Frete de Compra", null, "Stella Central"],
      ["Taxa de Cartão sobre a Venda", "Taxa de cartão", "Stella Central, TNI"],
      ["IPTU", "Imposto", "Stella Central, Albert Sabin"],
    ]);
    expect(resumo).toEqual({ itens: 4, semCategoria: 2, contasSemCategoria: 7 });
  });

  it("item só usado em conta (lançada direto no grupo) é marcado como fora do plano", () => {
    const { linhas } = montarItens(
      [{ item: "RECEITA OPERACIONAL", raizes: ["1"], no_plano: false, contas: 23, categoria_id: null }],
      categorias,
    );
    expect(linhas[0]).toMatchObject({ foraDoPlano: true, contas: 23 });
  });

  it("raiz 0 é o caixa; raiz desconhecida aparece como está", () => {
    const { linhas } = montarItens([{ item: "X", raizes: ["0", "9"], no_plano: true, contas: 0, categoria_id: null }], categorias);
    expect(linhas[0].unidades).toBe("Caixa, raiz 9");
  });

  it("contas chegam como texto (bigint do banco)", () => {
    const { resumo } = montarItens([{ item: "X", raizes: ["1"], no_plano: true, contas: "12", categoria_id: null }], categorias);
    expect(resumo.contasSemCategoria).toBe(12);
  });
});

describe("lerNatureza", () => {
  it("aceita pagar e receber; o resto cai no padrão pagar", () => {
    expect(lerNatureza("receber")).toBe("receber");
    expect(lerNatureza("pagar")).toBe("pagar");
    expect(lerNatureza("RECEBER")).toBe("pagar");
    expect(lerNatureza(undefined)).toBe("pagar");
    expect(lerNatureza(["receber"])).toBe("pagar");
  });
});

describe("validarNomeDeCategoria", () => {
  const existentes = [
    { id: 1, nome: "Imposto" },
    { id: 2, nome: "Taxa de cartão" },
  ];

  it("apara as pontas e junta espaços repetidos", () => {
    expect(validarNomeDeCategoria("  Serviços   de  terceiros ", existentes)).toEqual({ ok: true, nome: "Serviços de terceiros" });
  });

  it("recusa nome vazio", () => {
    expect(validarNomeDeCategoria("   ", existentes)).toEqual({ ok: false, erro: "Escreva o nome da categoria." });
  });

  it("recusa nome com mais de 60 caracteres", () => {
    expect(validarNomeDeCategoria("a".repeat(61), existentes)).toEqual({
      ok: false,
      erro: "O nome pode ter até 60 caracteres.",
    });
    expect(validarNomeDeCategoria("a".repeat(60), existentes).ok).toBe(true);
  });

  it("recusa nome repetido na mesma lista, sem diferenciar maiúsculas", () => {
    expect(validarNomeDeCategoria("imposto", existentes)).toEqual({ ok: false, erro: 'Já existe a categoria "Imposto".' });
  });

  it("recusa nome que vira o mesmo identificador de outra categoria, inclusive da outra lista", () => {
    expect(validarNomeDeCategoria("Impostó", existentes)).toEqual({ ok: false, erro: 'Já existe a categoria "Imposto".' });
    expect(validarNomeDeCategoria("Taxa de Cartao", existentes).ok).toBe(false);
  });

  it("recusa nome reservado ou sem letra nem número", () => {
    expect(validarNomeDeCategoria("Sem categoria", existentes)).toEqual({ ok: false, erro: '"Sem categoria" é reservado.' });
    expect(validarNomeDeCategoria("!!!", existentes)).toEqual({ ok: false, erro: "O nome precisa ter letra ou número." });
  });

  it("renomear a própria categoria para outra grafia vale", () => {
    expect(validarNomeDeCategoria("IMPOSTO", existentes, 1)).toEqual({ ok: true, nome: "IMPOSTO" });
    expect(validarNomeDeCategoria("Imposto", existentes, 2).ok).toBe(false);
  });
});

describe("validarTrocaDeCategoria", () => {
  const categorias = [
    { id: 1, natureza: "pagar" as const, nome: "Imposto" },
    { id: 20, natureza: "receber" as const, nome: "Endoscopia" },
  ];

  it("liga o item a uma categoria da mesma lista", () => {
    expect(validarTrocaDeCategoria({ natureza: "pagar", item: "IPTU", categoria: "1" }, categorias)).toEqual({
      ok: true,
      natureza: "pagar",
      item: "IPTU",
      categoriaId: 1,
    });
  });

  it("categoria vazia deixa o item sem categoria", () => {
    expect(validarTrocaDeCategoria({ natureza: "receber", item: "Receitas CPRE", categoria: "" }, categorias)).toEqual({
      ok: true,
      natureza: "receber",
      item: "Receitas CPRE",
      categoriaId: null,
    });
  });

  it("recusa categoria da outra lista (D-3)", () => {
    expect(validarTrocaDeCategoria({ natureza: "pagar", item: "IPTU", categoria: "20" }, categorias)).toEqual({
      ok: false,
      erro: "Essa categoria não existe na lista a pagar.",
    });
  });

  it("recusa categoria que não existe ou não é número", () => {
    expect(validarTrocaDeCategoria({ natureza: "pagar", item: "IPTU", categoria: "99" }, categorias).ok).toBe(false);
    expect(validarTrocaDeCategoria({ natureza: "pagar", item: "IPTU", categoria: "1abc" }, categorias).ok).toBe(false);
  });

  it("recusa natureza desconhecida em vez de cair no padrão", () => {
    expect(validarTrocaDeCategoria({ natureza: "RECEBER", item: "IPTU", categoria: "1" }, categorias)).toEqual({
      ok: false,
      erro: "Natureza inválida.",
    });
  });

  it("recusa item vazio ou com o sufixo da unidade: a ligação vale para as três raízes", () => {
    expect(validarTrocaDeCategoria({ natureza: "pagar", item: "  ", categoria: "1" }, categorias)).toEqual({
      ok: false,
      erro: "Item inválido.",
    });
    expect(validarTrocaDeCategoria({ natureza: "pagar", item: "IPTU (SABIN)", categoria: "1" }, categorias)).toEqual({
      ok: false,
      erro: "Item inválido.",
    });
  });
});

describe("slugDaCategoria (espelho de slug_da_categoria no banco)", () => {
  it("tira acento, junta o resto com hífen e apara", () => {
    expect(slugDaCategoria("Manutenção e exames")).toBe("manutencao-e-exames");
    expect(slugDaCategoria(" pH-metria ")).toBe("ph-metria");
    expect(slugDaCategoria("Repasse de honorário médico")).toBe("repasse-de-honorario-medico");
    expect(slugDaCategoria("!!!")).toBe("");
  });
});
