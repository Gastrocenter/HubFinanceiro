import { describe, expect, it } from "vitest";
import { executarRotinaDiaria } from "./rotina-diaria";

describe("executarRotinaDiaria", () => {
  it("roda o expurgo LGPD mesmo quando enfileirar falha, e o erro continua visível", async () => {
    const feito: string[] = [];
    const rodada = executarRotinaDiaria({
      enfileirar: async () => {
        feito.push("enfileirar");
        throw new Error("de-para indisponível");
      },
      expurgar: async () => {
        feito.push("expurgar");
        return 3;
      },
    });
    await expect(rodada).rejects.toThrow(/de-para indisponível/);
    expect(feito).toEqual(["enfileirar", "expurgar"]);
  });

  it("quando tudo dá certo, devolve o resultado das duas etapas", async () => {
    const r = await executarRotinaDiaria({ enfileirar: async () => ({ jobs: 6 }), expurgar: async () => 2 });
    expect(r).toEqual({ enfileirado: { jobs: 6 }, expurgadas: 2 });
  });

  it("se as duas falham, o erro cita as duas", async () => {
    const rodada = executarRotinaDiaria({
      enfileirar: async () => {
        throw new Error("falha A");
      },
      expurgar: async () => {
        throw new Error("falha B");
      },
    });
    await expect(rodada).rejects.toThrow(/falha A.*falha B/s);
  });
});
