import { describe, expect, it } from "vitest";
import { buscaPara, estaAtivo, itemAtivo, menuPara, trilhaDe } from "./menu";

const hrefs = (perfis: Parameters<typeof menuPara>[0]) => menuPara(perfis).flatMap((s) => s.itens.map((i) => i.href));

describe("menuPara", () => {
  it("admin vê todas as telas, auditoria inclusive", () => {
    expect(hrefs(["admin"])).toEqual(["/painel", "/receita", "/repasses", "/contas", "/conferencia", "/cadastros", "/cadastros/categorias", "/admin/auditoria"]);
  });

  it("aprovador não vê cadastros nem auditoria", () => {
    expect(hrefs(["aprovador"])).toEqual(["/painel", "/receita", "/repasses", "/contas", "/conferencia"]);
  });

  it("restrito só vê o painel, e seção sem item some", () => {
    const menu = menuPara(["restrito"]);
    expect(menu.map((s) => s.titulo)).toEqual(["Geral"]);
    expect(hrefs(["restrito"])).toEqual(["/painel"]);
  });

  it("perfis acumulados somam as telas, sem repetir", () => {
    expect(hrefs(["aprovador", "financeiro"])).toEqual(["/painel", "/receita", "/repasses", "/contas", "/conferencia", "/cadastros", "/cadastros/categorias"]);
  });

  it("sem perfil, nenhum item", () => {
    expect(menuPara([])).toEqual([]);
  });
});

describe("buscaPara", () => {
  const destinos = (perfis: Parameters<typeof buscaPara>[0]) => buscaPara(perfis).flatMap((g) => g.destinos.map((d) => d.href));

  it("tem as mesmas telas do menu, na mesma ordem, mais os atalhos permitidos", () => {
    const grupos = buscaPara(["admin"]);
    expect(grupos.map((g) => g.titulo)).toEqual(["Geral", "Financeiro", "Controle", "Atalhos"]);
    expect(grupos.slice(0, 3).flatMap((g) => g.destinos.map((d) => d.href))).toEqual(hrefs(["admin"]));
  });

  it("atalho de cadastro só aparece para quem revisa cadastros", () => {
    expect(destinos(["aprovador"])).toContain("/conferencia?estado=resolvida");
    expect(destinos(["aprovador"]).some((h) => h.startsWith("/cadastros"))).toBe(false);
  });

  it("sem atalho permitido, não há grupo de atalhos", () => {
    expect(buscaPara(["restrito"]).map((g) => g.titulo)).toEqual(["Geral"]);
  });

  it("toda tela tem palavras extras para a busca", () => {
    for (const d of buscaPara(["admin"]).flatMap((g) => g.destinos)) expect(d.palavras.length).toBeGreaterThan(0);
  });
});

describe("estaAtivo", () => {
  it("vale para a própria rota e as abaixo dela, não para prefixo de nome", () => {
    expect(estaAtivo("/conferencia", "/conferencia")).toBe(true);
    expect(estaAtivo("/conferencia/123", "/conferencia")).toBe(true);
    expect(estaAtivo("/conferencias", "/conferencia")).toBe(false);
    expect(estaAtivo("/painel", "/conferencia")).toBe(false);
  });
});

describe("itemAtivo", () => {
  it("rota abaixo de dois itens fica com o mais específico", () => {
    const hrefs = ["/cadastros", "/cadastros/categorias"];
    expect(itemAtivo("/cadastros/categorias", hrefs)).toBe("/cadastros/categorias");
    expect(itemAtivo("/cadastros", hrefs)).toBe("/cadastros");
    expect(itemAtivo("/painel", hrefs)).toBeUndefined();
  });
});

describe("trilhaDe", () => {
  it("Categorias fica em Controle, não em Cadastros e de-para", () => {
    expect(trilhaDe("/cadastros/categorias")).toEqual([{ rotulo: "Controle" }, { rotulo: "Categorias", href: "/cadastros/categorias" }]);
  });

  it("seção e tela, só a tela com link", () => {
    expect(trilhaDe("/receita")).toEqual([{ rotulo: "Financeiro" }, { rotulo: "Receita", href: "/receita" }]);
    expect(trilhaDe("/admin/auditoria")).toEqual([{ rotulo: "Controle" }, { rotulo: "Auditoria", href: "/admin/auditoria" }]);
  });

  it("subrota fica na tela de cima", () => {
    expect(trilhaDe("/conferencia/42")).toEqual([{ rotulo: "Controle" }, { rotulo: "Conferência", href: "/conferencia" }]);
  });

  it("rota fora do menu não tem trilha", () => {
    expect(trilhaDe("/sem-acesso")).toEqual([]);
  });
});
