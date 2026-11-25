import { describe, expect, it } from "vitest";
import { decidirAcesso } from "./acesso";

describe("decidirAcesso", () => {
  it("sem sessão, redireciona para o login", () => {
    expect(decidirAcesso(null, "lancar_despesa")).toEqual({ tipo: "redirecionar", para: "/login" });
  });

  it("logado sem o perfil exigido, nega o acesso", () => {
    const aprovador = { usuarioId: "u1", perfis: ["aprovador"], ativo: true } as const;
    expect(decidirAcesso(aprovador, "pagar_despesa")).toEqual({ tipo: "negado" });
  });

  it("logado com o perfil exigido, libera", () => {
    const financeiro = { usuarioId: "u2", perfis: ["financeiro"], ativo: true } as const;
    expect(decidirAcesso(financeiro, "pagar_despesa")).toEqual({ tipo: "liberado" });
  });

  it("usuário desativado é negado mesmo com o perfil certo", () => {
    const desativado = { usuarioId: "u3", perfis: ["financeiro"], ativo: false } as const;
    expect(decidirAcesso(desativado, "pagar_despesa")).toEqual({ tipo: "negado" });
  });
});
