import { diferencaPorChave, semRepetidosPorChave, type Atual, type Diferenca } from "@/sync/diferenca-por-chave";
import type { RegistroDeProcedimento } from "./ler-procedimentos";

/** O que o Hub já tem de um procedimento do mês. */
export type ProcedimentoAtual = Atual<RegistroDeProcedimento>;

export type DiferencaDoMes = Diferenca<RegistroDeProcedimento>;

/** Chave natural dentro de uma empresa: (unidade, conta, linha). A fatura fica de fora (D-N). */
export function chaveDoProcedimento(p: Pick<RegistroDeProcedimento, "codigoLocal" | "conta" | "linha">): string {
  return `${p.codigoLocal}:${p.conta}:${p.linha}`;
}

/** Uma linha por chave, a última que veio: a paginação pode repetir um registro quando os dados mudam durante a busca. */
export function semRepetidos(vindos: RegistroDeProcedimento[]): RegistroDeProcedimento[] {
  return semRepetidosPorChave(vindos, chaveDoProcedimento);
}

/** Compara o que o Hub tem de um mês com o que veio do ProDoctor para o mesmo mês (escopo inteiro do mês). */
export function diferencaDoMes(atuais: ProcedimentoAtual[], vindos: RegistroDeProcedimento[]): DiferencaDoMes {
  return diferencaPorChave(atuais, vindos, chaveDoProcedimento, "procedimentos");
}
