export type Relogio = {
  agora: () => number;
  esperar: (ms: number) => Promise<void>;
};

export const relogioReal: Relogio = {
  agora: () => Date.now(),
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
};

/**
 * Janela deslizante: nunca mais de `maxPorJanela` chamadas em qualquer intervalo de `janelaMs` (L4: 120/min).
 * Devolve uma função para aguardar a vez antes de cada chamada.
 */
export function criarLimitador({
  maxPorJanela,
  janelaMs,
  relogio = relogioReal,
}: {
  maxPorJanela: number;
  janelaMs: number;
  relogio?: Relogio;
}): () => Promise<void> {
  const instantes: number[] = [];
  // Fila: chamadas paralelas são atendidas uma por vez, senão todas leem a janela ao mesmo tempo.
  let fila: Promise<void> = Promise.resolve();

  async function liberarUma() {
    const agora = relogio.agora();
    while (instantes.length > 0 && instantes[0] <= agora - janelaMs) instantes.shift();
    if (instantes.length >= maxPorJanela) {
      await relogio.esperar(instantes[0] + janelaMs - agora);
      instantes.shift();
    }
    instantes.push(relogio.agora());
  }

  return function aguardarVez() {
    const vez = fila.then(liberarUma);
    fila = vez.catch(() => {});
    return vez;
  };
}
