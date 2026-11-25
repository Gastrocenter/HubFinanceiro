import { describe, expect, it } from "vitest";
import { criarLimitador, type Relogio } from "./limitador";

/** Relógio falso: esperar(ms) só avança o tempo, sem dormir de verdade. */
function relogioFalso(inicio = 0) {
  let agora = inicio;
  const esperas: number[] = [];
  const relogio: Relogio = {
    agora: () => agora,
    esperar: async (ms) => {
      esperas.push(ms);
      agora += ms;
    },
  };
  return { relogio, esperas, avancar: (ms: number) => (agora += ms), agora: () => agora };
}

describe("criarLimitador", () => {
  it("deixa passar 120 chamadas e faz a 121ª esperar a janela de 60 s abrir", async () => {
    const r = relogioFalso();
    const aguardarVez = criarLimitador({ maxPorJanela: 120, janelaMs: 60_000, relogio: r.relogio });

    for (let i = 0; i < 120; i++) await aguardarVez();
    expect(r.esperas).toEqual([]);

    await aguardarVez();
    expect(r.esperas).toEqual([60_000]);
  });

  it("com 250 chamadas em paralelo, nenhuma janela de 60 s passa de 120", async () => {
    const r = relogioFalso();
    const aguardarVez = criarLimitador({ maxPorJanela: 120, janelaMs: 60_000, relogio: r.relogio });

    const liberadas: number[] = [];
    await Promise.all(Array.from({ length: 250 }, () => aguardarVez().then(() => liberadas.push(r.agora()))));

    expect(liberadas).toHaveLength(250);
    for (const inicio of liberadas) {
      const naJanela = liberadas.filter((t) => t >= inicio && t < inicio + 60_000).length;
      expect(naJanela).toBeLessThanOrEqual(120);
    }
  });
});
