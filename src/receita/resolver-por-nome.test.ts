import { describe, expect, it } from "vitest";
import { resolverPorNome } from "./resolver-por-nome";

const cadastros = [
  { id: 1, nome: "Dra. Ana Teste" },
  { id: 2, nome: "Dr. Bruno Teste" },
  { id: 3, nome: "Dr. Carlos Repetido" },
  { id: 4, nome: "Dr. Carlos Repetido" },
];

describe("resolverPorNome", () => {
  it("casa pelo nome exato", () => {
    expect(resolverPorNome("Dra. Ana Teste", cadastros)).toEqual({ tipo: "casou", id: 1 });
  });

  it("homônimo é ambíguo, com os candidatos; o Hub não escolhe sozinho (D-I)", () => {
    expect(resolverPorNome("Dr. Carlos Repetido", cadastros)).toEqual({ tipo: "ambiguo", ids: [3, 4] });
  });

  it("sem par exato não casa, nem por aproximação de maiúsculas ou espaços", () => {
    expect(resolverPorNome("DRA. ANA TESTE", cadastros)).toEqual({ tipo: "nao_encontrado" });
    expect(resolverPorNome("Dra.  Ana Teste", cadastros)).toEqual({ tipo: "nao_encontrado" });
    expect(resolverPorNome("", cadastros)).toEqual({ tipo: "nao_encontrado" });
  });
});
