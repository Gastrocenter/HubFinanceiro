/** O que o Hub já tem de um registro do mês. */
export type Atual<T> = { registro: T; vistoNaUltimaSync: boolean };

export type Diferenca<T> = {
  novos: T[];
  alterados: { registro: T; campos: (keyof T)[] }[];
  sumiram: string[];
  voltaram: string[];
};

/** Uma linha por chave, a última que veio: a paginação pode repetir um registro quando os dados mudam durante a busca. */
export function semRepetidosPorChave<T>(vindos: T[], chave: (r: T) => string): T[] {
  const porChave = new Map<string, T>();
  for (const v of vindos) {
    const k = chave(v);
    porChave.delete(k);
    porChave.set(k, v);
  }
  return [...porChave.values()];
}

/**
 * Compara o que o Hub tem de um mês com o que veio do ProDoctor para o mesmo mês (escopo inteiro do mês).
 * Sumiu do mês: marca (L3), nunca apaga. `oQue` só aparece na mensagem de erro.
 */
export function diferencaPorChave<T extends object>(
  atuais: Atual<T>[],
  vindosComRepetidos: T[],
  chave: (r: T) => string,
  oQue: string,
): Diferenca<T> {
  const vindos = semRepetidosPorChave(vindosComRepetidos, chave);
  // Proteção: mês com registros que de repente vem vazio é quase certamente falha, não exclusão em massa.
  if (vindos.length === 0 && atuais.some((a) => a.vistoNaUltimaSync)) {
    throw new Error(`Mês veio vazio do ProDoctor, mas o Hub já tem ${oQue} nele: diferença recusada.`);
  }
  const porChave = new Map(atuais.map((a) => [chave(a.registro), a]));
  const diferenca: Diferenca<T> = { novos: [], alterados: [], sumiram: [], voltaram: [] };

  for (const vindo of vindos) {
    const existente = porChave.get(chave(vindo));
    if (!existente) {
      diferenca.novos.push(vindo);
      continue;
    }
    if (!existente.vistoNaUltimaSync) diferenca.voltaram.push(chave(vindo));
    const campos = (Object.keys(vindo) as (keyof T)[]).filter((c) => vindo[c] !== existente.registro[c]);
    if (campos.length > 0) diferenca.alterados.push({ registro: vindo, campos });
  }

  const vindas = new Set(vindos.map(chave));
  diferenca.sumiram = atuais.filter((a) => a.vistoNaUltimaSync && !vindas.has(chave(a.registro))).map((a) => chave(a.registro));
  return diferenca;
}
