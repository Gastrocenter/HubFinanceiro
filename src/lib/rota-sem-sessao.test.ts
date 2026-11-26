import { describe, expect, it } from "vitest";
import { ehRotaSemSessao, ficaForaDaSessao } from "./rota-sem-sessao";

describe("ehRotaSemSessao", () => {
  it("libera o login, as ilustrações e os agendamentos, inclusive o que está abaixo deles", () => {
    for (const caminho of ["/login", "/login/", "/login/esqueci", "/illustrations/logo.svg", "/api/agendamentos", "/api/agendamentos/sincronizar"]) {
      expect(ehRotaSemSessao(caminho), caminho).toBe(true);
    }
  });

  it("não libera rota que só começa com o mesmo texto (code-review item 10)", () => {
    for (const caminho of ["/login-suporte", "/loginx", "/illustrationsx", "/illustrations-admin/x", "/api/agendamentos-x", "/api/agendamentosx/y"]) {
      expect(ehRotaSemSessao(caminho), caminho).toBe(false);
    }
  });

  it("só ilustrações e agendamentos ficam fora da sessão; o login ainda renova o token", () => {
    expect(ficaForaDaSessao("/api/agendamentos/sincronizar")).toBe(true);
    expect(ficaForaDaSessao("/illustrations/logo.svg")).toBe(true);
    expect(ficaForaDaSessao("/api/agendamentos-x")).toBe(false);
    expect(ficaForaDaSessao("/login")).toBe(false);
  });

  it("exige sessão no resto, inclusive na raiz e em rotas que só contêm o nome", () => {
    for (const caminho of ["/", "/painel", "/admin/login", "/api/x/agendamentos", "/contas"]) {
      expect(ehRotaSemSessao(caminho), caminho).toBe(false);
    }
  });
});
