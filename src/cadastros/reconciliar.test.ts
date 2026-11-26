import { describe, expect, it } from "vitest";
import type { RegistroDeOrigem } from "./ler-cadastros";
import { reconciliar, type CadastroAtual } from "./reconciliar";

const prof = (codigo: string, nome: string, ativo = true): RegistroDeOrigem => ({ tipo: "profissional", codigoOrigem: codigo, nome, ativo });
const atual = (codigo: string, nome: string, extra: Partial<CadastroAtual> = {}): CadastroAtual => ({
  codigoOrigem: codigo,
  nome,
  ativo: true,
  vistoNaUltimaSync: true,
  ...extra,
});

const planoVazio = { criar: [], atualizar: [], sumiram: [], voltaram: [] };

describe("reconciliar", () => {
  it("o que o Hub ainda não tem entra para criar", () => {
    expect(reconciliar([], [prof("1", "Ana"), prof("2", "Bruno")])).toEqual({
      ...planoVazio,
      criar: [prof("1", "Ana"), prof("2", "Bruno")],
    });
  });

  it("atualiza só o que mudou (nome, ativo); o que está igual não gera nada", () => {
    const atuais = [atual("1", "Ana"), atual("2", "Bruno"), atual("3", "Carla")];
    const vindos = [prof("1", "Ana"), prof("2", "Bruno Souza"), prof("3", "Carla", false)];
    expect(reconciliar(atuais, vindos)).toEqual({
      ...planoVazio,
      atualizar: [
        { codigoOrigem: "2", nome: "Bruno Souza" },
        { codigoOrigem: "3", ativo: false },
      ],
    });
    expect(reconciliar(atuais, [prof("1", "Ana"), prof("2", "Bruno"), prof("3", "Carla")])).toEqual(planoVazio);
  });

  it("marca o que sumiu do ProDoctor (L3) e o que voltou; quem já estava sumido não é marcado de novo", () => {
    const atuais = [atual("1", "Ana"), atual("2", "Bruno"), atual("3", "Carla", { vistoNaUltimaSync: false }), atual("4", "Davi", { vistoNaUltimaSync: false })];
    const vindos = [prof("1", "Ana"), prof("3", "Carla")];
    expect(reconciliar(atuais, vindos)).toEqual({ ...planoVazio, sumiram: ["2"], voltaram: ["3"] });
  });

  it("recusa cadastro vindo vazio quando o Hub já tem registros (não marca todo mundo como sumido)", () => {
    expect(() => reconciliar([atual("1", "Ana"), atual("2", "Bruno")], [])).toThrow(/vazio/);
    expect(reconciliar([], [])).toEqual(planoVazio);
  });
});
