import { describe, expect, it } from "vitest";
import { ErroHttpProDoctor, comRetentativas } from "./retentativa";
import type { Relogio } from "./limitador";

function relogioFalso() {
  const esperas: number[] = [];
  const relogio: Relogio = { agora: () => 0, esperar: async (ms) => void esperas.push(ms) };
  return { relogio, esperas };
}

/** Função que falha com os erros dados, em ordem, e depois devolve "ok". */
function falhaComEssesErros(erros: unknown[]) {
  let chamadas = 0;
  const fn = async () => {
    const erro = erros[chamadas++];
    if (erro) throw erro;
    return "ok";
  };
  return { fn, chamadas: () => chamadas };
}

describe("comRetentativas", () => {
  it("tenta de novo em 503, com espera dobrando, e devolve o resultado", async () => {
    const r = relogioFalso();
    const f = falhaComEssesErros([new ErroHttpProDoctor(503, "/x"), new ErroHttpProDoctor(503, "/x")]);
    await expect(comRetentativas(f.fn, { relogio: r.relogio })).resolves.toBe("ok");
    expect(f.chamadas()).toBe(3);
    expect(r.esperas).toEqual([1000, 2000]);
  });

  it("trata falha de rede e 429 como passageiras", async () => {
    const r = relogioFalso();
    const f = falhaComEssesErros([new TypeError("fetch failed"), new ErroHttpProDoctor(429, "/x")]);
    await expect(comRetentativas(f.fn, { relogio: r.relogio })).resolves.toBe("ok");
    expect(f.chamadas()).toBe(3);
  });

  it("desiste depois do máximo de tentativas e devolve o último erro", async () => {
    const r = relogioFalso();
    const erros = [500, 502, 503, 504, 500].map((s) => new ErroHttpProDoctor(s, "/x"));
    const f = falhaComEssesErros(erros);
    await expect(comRetentativas(f.fn, { tentativas: 4, relogio: r.relogio })).rejects.toMatchObject({ status: 504 });
    expect(f.chamadas()).toBe(4);
    expect(r.esperas).toEqual([1000, 2000, 4000]);
  });

  it("não tenta de novo erro que não é passageiro (400, 401, 403, 404)", async () => {
    for (const status of [400, 401, 403, 404]) {
      const r = relogioFalso();
      const f = falhaComEssesErros([new ErroHttpProDoctor(status, "/x")]);
      await expect(comRetentativas(f.fn, { relogio: r.relogio }), String(status)).rejects.toMatchObject({ status });
      expect(f.chamadas(), String(status)).toBe(1);
      expect(r.esperas).toEqual([]);
    }
  });
});
