import { describe, expect, it } from "vitest";
import { estaAtivo, menuPara, trilhaDe } from "./menu";

const hrefs = (perfis: Parameters<typeof menuPara>[0]) => menuPara(perfis).flatMap((s) => s.itens.map((i) => i.href));

describe("menuPara", () => {
  it("admin vê todas as telas, auditoria inclusive", () => {
    expect(hrefs(["admin"])).toEqual(["/painel", "/receita", "/repasses", "/contas", "/conferencia", "/cadastros", "/admin/auditoria"]);
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
    expect(hrefs(["aprovador", "financeiro"])).toEqual(["/painel", "/receita", "/repasses", "/contas", "/conferencia", "/cadastros"]);
  });

  it("sem perfil, nenhum item", () => {
    expect(menuPara([])).toEqual([]);
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

describe("trilhaDe", () => {
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
