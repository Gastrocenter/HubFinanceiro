import { describe, expect, it } from "vitest";
import { temPermissao } from "./permissoes";

describe("temPermissao", () => {
  it("aprovador aprova despesa, mas não paga (RN-06 e RN-07)", () => {
    expect(temPermissao(["aprovador"], "aprovar_despesa")).toBe(true);
    expect(temPermissao(["aprovador"], "pagar_despesa")).toBe(false);
  });

  it("financeiro lança e paga despesa, mas não aprova (D8: quem aprova não é quem paga)", () => {
    expect(temPermissao(["financeiro"], "lancar_despesa")).toBe(true);
    expect(temPermissao(["financeiro"], "pagar_despesa")).toBe(true);
    expect(temPermissao(["financeiro"], "aprovar_despesa")).toBe(false);
  });

  it("admin, financeiro e aprovador veem a receita; restrito não", () => {
    for (const perfil of ["admin", "financeiro", "aprovador"] as const) expect(temPermissao([perfil], "ver_receita"), perfil).toBe(true);
    expect(temPermissao(["restrito"], "ver_receita")).toBe(false);
  });

  it("admin, financeiro e aprovador veem os repasses; restrito não", () => {
    for (const perfil of ["admin", "financeiro", "aprovador"] as const) expect(temPermissao([perfil], "ver_repasse"), perfil).toBe(true);
    expect(temPermissao(["restrito"], "ver_repasse")).toBe(false);
  });

  it("admin, financeiro e aprovador veem a conferência; só admin e financeiro resolvem pendência (issue 08, D-B)", () => {
    for (const perfil of ["admin", "financeiro", "aprovador"] as const) expect(temPermissao([perfil], "ver_conferencia"), perfil).toBe(true);
    expect(temPermissao(["restrito"], "ver_conferencia")).toBe(false);
    expect(temPermissao(["admin"], "resolver_pendencia")).toBe(true);
    expect(temPermissao(["financeiro"], "resolver_pendencia")).toBe(true);
    expect(temPermissao(["aprovador"], "resolver_pendencia")).toBe(false);
    expect(temPermissao(["restrito"], "resolver_pendencia")).toBe(false);
  });

  it("admin, financeiro e aprovador veem as contas a pagar/receber; restrito não (issue 08b)", () => {
    for (const perfil of ["admin", "financeiro", "aprovador"] as const) expect(temPermissao([perfil], "ver_contas"), perfil).toBe(true);
    expect(temPermissao(["restrito"], "ver_contas")).toBe(false);
  });

  it("admin e financeiro revisam cadastros e de-para; aprovador e restrito não", () => {
    expect(temPermissao(["admin"], "revisar_cadastros")).toBe(true);
    expect(temPermissao(["financeiro"], "revisar_cadastros")).toBe(true);
    expect(temPermissao(["aprovador"], "revisar_cadastros")).toBe(false);
    expect(temPermissao(["restrito"], "revisar_cadastros")).toBe(false);
  });

  it("todo perfil acessa o painel inicial, e quem não tem perfil não acessa", () => {
    for (const perfil of ["admin", "financeiro", "aprovador", "restrito"] as const) {
      expect(temPermissao([perfil], "acessar_painel")).toBe(true);
    }
    expect(temPermissao([], "acessar_painel")).toBe(false);
  });

  it("perfis acumulam permissões, e quem não tem perfil não tem nenhuma", () => {
    const perfis = ["financeiro", "aprovador"] as const;
    expect(temPermissao(perfis, "aprovar_despesa")).toBe(true);
    expect(temPermissao(perfis, "pagar_despesa")).toBe(true);
    expect(temPermissao([], "lancar_despesa")).toBe(false);
  });

  it("só o admin gerencia usuários e lê a auditoria", () => {
    for (const acao of ["gerenciar_usuarios", "ver_auditoria"] as const) {
      expect(temPermissao(["admin"], acao)).toBe(true);
      for (const perfil of ["financeiro", "aprovador", "restrito"] as const) {
        expect(temPermissao([perfil], acao)).toBe(false);
      }
    }
  });

  it("só o perfil restrito vê a folha individual (RN-11), nem o admin vê", () => {
    expect(temPermissao(["restrito"], "ver_folha_individual")).toBe(true);
    for (const perfil of ["admin", "financeiro", "aprovador"] as const) {
      expect(temPermissao([perfil], "ver_folha_individual")).toBe(false);
    }
  });
});
