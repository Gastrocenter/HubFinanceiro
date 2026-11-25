import { relogioReal, type Relogio } from "./limitador";

/** Resposta HTTP de erro do ProDoctor. Nunca carrega cabeçalhos nem credenciais. */
export class ErroHttpProDoctor extends Error {
  constructor(
    readonly status: number,
    readonly rota: string,
    mensagemDaApi?: string,
  ) {
    super(`ProDoctor respondeu ${status} em ${rota}${mensagemDaApi ? `: ${mensagemDaApi}` : ""}`);
    this.name = "ErroHttpProDoctor";
  }
}

/** Passageiro: limite de taxa (429), erro do servidor (5xx) ou falha de rede (sem status). */
export function ehFalhaPassageira(erro: unknown): boolean {
  if (erro instanceof ErroHttpProDoctor) return erro.status === 429 || erro.status >= 500;
  return erro instanceof TypeError; // fetch lança TypeError em falha de rede
}

export type OpcoesDeRetentativa = {
  tentativas?: number;
  esperaInicialMs?: number;
  relogio?: Relogio;
};

/** Executa `fn`; em falha passageira, espera (1 s, 2 s, 4 s...) e tenta de novo. */
export async function comRetentativas<T>(
  fn: () => Promise<T>,
  { tentativas = 4, esperaInicialMs = 1000, relogio = relogioReal }: OpcoesDeRetentativa = {},
): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await fn();
    } catch (erro) {
      if (tentativa >= tentativas || !ehFalhaPassageira(erro)) throw erro;
      await relogio.esperar(esperaInicialMs * 2 ** (tentativa - 1));
    }
  }
}
