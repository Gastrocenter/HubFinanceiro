import { diferencaPorChave, semRepetidosPorChave, type Atual, type Diferenca } from "@/sync/diferenca-por-chave";
import type { RegistroDeConta } from "./ler-contas";

export type ContaAtual = Atual<RegistroDeConta>;
export type DiferencaDoMesDeContas = Diferenca<RegistroDeConta>;

/** Uma conta é (unidade, número): o número é único na unidade. */
export const chaveDaConta = (c: Pick<RegistroDeConta, "codigoLocal" | "numero">) => `${c.codigoLocal}:${c.numero}`;

export const semContaRepetida = (vindas: RegistroDeConta[]) => semRepetidosPorChave(vindas, chaveDaConta);

/**
 * Compara um mês de inclusão (D-2) no Hub com o que veio do ProDoctor. Conta nova → novos; conta paga ou
 * editada → alterados; conta excluída no ProDoctor → sumiram (vira pendência, nunca é apagada).
 */
export function diferencaDoMesDeContas(atuais: ContaAtual[], vindas: RegistroDeConta[]): DiferencaDoMesDeContas {
  return diferencaPorChave(atuais, vindas, chaveDaConta, "contas a pagar/receber");
}
