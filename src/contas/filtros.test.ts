import { describe, expect, it } from "vitest";
import { filtrosLigados, filtrosParaBusca, lerFiltros, type FiltrosDeContas } from "./filtros";

const hoje = "2026-11-26";
const padrao: FiltrosDeContas = {
  aba: "stella",
  de: "2026-11-01",
  ate: "2026-11-30",
  tipoDeData: "vencimento",
  situacoes: [],
  categorias: [],
  fornecedor: null,
};

describe("lerFiltros", () => {
  it("endereço vazio: aba Stella Central, este mês, por vencimento, sem outros filtros", () => {
    expect(lerFiltros({}, hoje)).toEqual(padrao);
  });

  it("lê todos os filtros do endereço", () => {
    expect(
      lerFiltros(
        {
          aba: "sabin",
          de: "2026-10-01",
          ate: "2026-10-31",
          data: "efetivacao",
          situacao: ["aberta", "vencida"],
          categoria: ["imposto", "taxa-de-cartao"],
          fornecedor: "Unimed",
        },
        hoje,
      ),
    ).toEqual({
      aba: "sabin",
      de: "2026-10-01",
      ate: "2026-10-31",
      tipoDeData: "efetivacao",
      situacoes: ["aberta", "vencida"],
      categorias: ["imposto", "taxa-de-cartao"],
      fornecedor: "Unimed",
    });
  });

  it("valor inválido cai no padrão, campo a campo", () => {
    expect(lerFiltros({ aba: "tni", data: "pagamento", fornecedor: "   " }, hoje)).toEqual(padrao);
  });

  it("um dia só: de e até iguais", () => {
    expect(lerFiltros({ de: "2026-11-05", ate: "2026-11-05" }, hoje)).toMatchObject({ de: "2026-11-05", ate: "2026-11-05" });
  });

  it("período inválido, incompleto ou invertido cai inteiro em este mês", () => {
    for (const p of [
      { de: "2026-02-30", ate: "2026-03-10" },
      { de: "05/11/2026", ate: "2026-11-10" },
      { de: "2026-11-05" },
      { ate: "2026-11-05" },
      { de: "2026-11-10", ate: "2026-11-05" },
    ]) {
      expect(lerFiltros(p, hoje)).toMatchObject({ de: "2026-11-01", ate: "2026-11-30" });
    }
  });

  it("situação: ignora as inválidas e as repetidas, e guarda numa ordem fixa", () => {
    expect(lerFiltros({ situacao: ["vencida", "paga", "aberta", "vencida"] }, hoje).situacoes).toEqual(["aberta", "vencida"]);
    expect(lerFiltros({ situacao: "efetivada" }, hoje).situacoes).toEqual(["efetivada"]);
    expect(lerFiltros({ situacao: "xyz" }, hoje).situacoes).toEqual([]);
  });

  it("categorias: aceita várias, sem vazias nem repetidas", () => {
    expect(lerFiltros({ categoria: ["imposto", " ", "imposto", " pessoal "] }, hoje).categorias).toEqual(["imposto", "pessoal"]);
  });

  it("com o mesmo parâmetro repetido num campo de valor único, vale o primeiro", () => {
    expect(lerFiltros({ aba: ["todas", "sabin"], fornecedor: ["Unimed", "Outro"] }, hoje)).toMatchObject({
      aba: "todas",
      fornecedor: "Unimed",
    });
  });

  it("apara o fornecedor", () => {
    expect(lerFiltros({ fornecedor: "  Unimed  " }, hoje).fornecedor).toBe("Unimed");
  });

  it("o padrão de período acompanha o hoje injetado", () => {
    expect(lerFiltros({}, "2027-01-03")).toMatchObject({ de: "2027-01-01", ate: "2027-01-31" });
  });

  it("aceita URLSearchParams", () => {
    const busca = new URLSearchParams("aba=todas&situacao=aberta&situacao=vencida");
    expect(lerFiltros(busca, hoje)).toMatchObject({ aba: "todas", situacoes: ["aberta", "vencida"] });
  });
});

describe("filtrosParaBusca", () => {
  it("o padrão vira endereço vazio", () => {
    expect(filtrosParaBusca(padrao, hoje)).toBe("");
  });

  it("só escreve o que difere do padrão", () => {
    expect(filtrosParaBusca({ ...padrao, aba: "todas", categorias: ["imposto", "pessoal"] }, hoje)).toBe(
      "aba=todas&categoria=imposto&categoria=pessoal",
    );
  });

  it("escreve o período inteiro quando ele não é este mês", () => {
    expect(filtrosParaBusca({ ...padrao, de: "2026-11-05", ate: "2026-11-05" }, hoje)).toBe("de=2026-11-05&ate=2026-11-05");
  });

  it("ida e volta: ler o que foi escrito devolve os mesmos filtros", () => {
    const filtros: FiltrosDeContas = {
      aba: "sabin",
      de: "2026-10-01",
      ate: "2026-10-31",
      tipoDeData: "entrada",
      situacoes: ["efetivada"],
      categorias: ["repasse-tni"],
      fornecedor: "Fornecedor & Cia",
    };
    const busca = filtrosParaBusca(filtros, hoje);
    expect(busca).toBe(
      "aba=sabin&de=2026-10-01&ate=2026-10-31&data=entrada&situacao=efetivada&categoria=repasse-tni&fornecedor=Fornecedor+%26+Cia",
    );
    expect(lerFiltros(new URLSearchParams(busca), hoje)).toEqual(filtros);
  });
});

describe("filtrosLigados", () => {
  it("sem nada fora do padrão, zero", () => {
    expect(filtrosLigados(padrao, hoje)).toBe(0);
  });

  it("conta cada filtro do painel fora do padrão, uma vez cada", () => {
    expect(
      filtrosLigados({ ...padrao, situacoes: ["aberta", "vencida"], categorias: ["imposto", "pessoal"], fornecedor: "Unimed" }, hoje),
    ).toBe(3);
    expect(filtrosLigados({ ...padrao, de: "2026-10-01", ate: "2026-10-31", tipoDeData: "entrada" }, hoje)).toBe(2);
  });

  it("a aba não é filtro do painel", () => {
    expect(filtrosLigados({ ...padrao, aba: "todas" }, hoje)).toBe(0);
  });
});
