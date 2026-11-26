import { describe, expect, it } from "vitest";
import { lerCadastros } from "./ler-cadastros";

describe("lerCadastros", () => {
  it("usuários do ProDoctor viram profissionais, com o código como texto", () => {
    const pagina = { payload: { usuarios: [{ codigo: 7, nome: "Dra. Ana Teste" }] }, message: null };
    expect(lerCadastros("/api/v1/Usuarios", pagina)).toEqual([
      { tipo: "profissional", codigoOrigem: "7", nome: "Dra. Ana Teste", ativo: true },
    ]);
  });

  it("lê unidades e convênios, com estadoRegistro (0 = ativo) e o tipo do convênio", () => {
    const locais = { payload: { locaisProDoctor: [{ codigo: 1, nome: "Unidade Teste", estadoRegistro: 0 }] } };
    const convenios = {
      payload: {
        convenios: [
          { codigo: 10, nome: "Plano A", estadoRegistro: 0, tipoConvenio: 1, tabela: { codigo: 3 } },
          { codigo: 11, nome: "Plano B", estadoRegistro: 1, tipoConvenio: 0, tabela: { codigo: 3 } },
        ],
      },
    };
    expect(lerCadastros("/api/v1/LocaisProDoctor", locais)).toEqual([
      { tipo: "unidade", codigoOrigem: "1", nome: "Unidade Teste", ativo: true },
    ]);
    expect(lerCadastros("/api/v1/Convenios", convenios)).toEqual([
      { tipo: "convenio", codigoOrigem: "10", nome: "Plano A", ativo: true, tipoConvenio: 1 },
      { tipo: "convenio", codigoOrigem: "11", nome: "Plano B", ativo: false, tipoConvenio: 0 },
    ]);
  });

  it("rejeita registro sem código inteiro ou sem nome, e rota que não é de cadastro", () => {
    const comUsuarios = (u: unknown) => ({ payload: { usuarios: [u] } });
    expect(() => lerCadastros("/api/v1/Usuarios", comUsuarios({ codigo: "7", nome: "X" }))).toThrow(/código/);
    expect(() => lerCadastros("/api/v1/Usuarios", comUsuarios({ codigo: 7, nome: "  " }))).toThrow(/nome/);
    expect(() => lerCadastros("/api/v1/Usuarios", comUsuarios({ nome: "X" }))).toThrow(/código/);
    expect(() => lerCadastros("/api/v1/Exportacoes/Repasses", { payload: {} })).toThrow(/não é um cadastro/);
  });
});
