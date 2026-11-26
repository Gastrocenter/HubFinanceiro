import type { RegistroDeProcedimento } from "./ler-procedimentos";

/** O que o Hub já tem de um procedimento do mês. */
export type ProcedimentoAtual = { registro: RegistroDeProcedimento; vistoNaUltimaSync: boolean };

export type DiferencaDoMes = {
  novos: RegistroDeProcedimento[];
  alterados: { registro: RegistroDeProcedimento; campos: (keyof RegistroDeProcedimento)[] }[];
  sumiram: string[];
  voltaram: string[];
};

/** Chave natural dentro de uma empresa: (unidade, conta, linha). A fatura fica de fora (D-N). */
export function chaveDoProcedimento(p: Pick<RegistroDeProcedimento, "codigoLocal" | "conta" | "linha">): string {
  return `${p.codigoLocal}:${p.conta}:${p.linha}`;
}

/** Compara o que o Hub tem de um mês com o que veio do ProDoctor para o mesmo mês (escopo inteiro do mês). */
export function diferencaDoMes(atuais: ProcedimentoAtual[], vindos: RegistroDeProcedimento[]): DiferencaDoMes {
  // Proteção: mês com procedimentos que de repente vem vazio é quase certamente falha, não exclusão em massa.
  if (vindos.length === 0 && atuais.some((a) => a.vistoNaUltimaSync)) {
    throw new Error("Mês veio vazio do ProDoctor, mas o Hub já tem procedimentos nele: diferença recusada.");
  }
  const porChave = new Map(atuais.map((a) => [chaveDoProcedimento(a.registro), a]));
  const diferenca: DiferencaDoMes = { novos: [], alterados: [], sumiram: [], voltaram: [] };

  for (const vindo of vindos) {
    const existente = porChave.get(chaveDoProcedimento(vindo));
    if (!existente) {
      diferenca.novos.push(vindo);
      continue;
    }
    if (!existente.vistoNaUltimaSync) diferenca.voltaram.push(chaveDoProcedimento(vindo));
    const campos = (Object.keys(vindo) as (keyof RegistroDeProcedimento)[]).filter((c) => vindo[c] !== existente.registro[c]);
    if (campos.length > 0) diferenca.alterados.push({ registro: vindo, campos });
  }

  // Sumiu do mês: marca (L3), nunca apaga.
  const vindas = new Set(vindos.map(chaveDoProcedimento));
  diferenca.sumiram = atuais
    .filter((a) => a.vistoNaUltimaSync && !vindas.has(chaveDoProcedimento(a.registro)))
    .map((a) => chaveDoProcedimento(a.registro));
  return diferenca;
}
