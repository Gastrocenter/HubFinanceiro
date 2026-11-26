import { chaveDoProcedimento } from "@/receita/diferenca-do-mes";
import { diferencaPorChave, semRepetidosPorChave, type Atual, type Diferenca } from "@/sync/diferenca-por-chave";
import type { RegistroDeRepasse } from "./ler-repasses";

export type RepasseAtual = Atual<RegistroDeRepasse>;
export type DiferencaDoMesDeRepasse = Diferenca<RegistroDeRepasse>;

/**
 * Um repasse é um procedimento (unidade, conta, linha) num lote: o mesmo procedimento pode voltar num lote de
 * outro mês (ex.: lote de jan com valor e lote de fev com 0). O recebível se liga pela parte do procedimento.
 */
export const chaveDoRepasse = (r: Pick<RegistroDeRepasse, "codigoLocal" | "conta" | "linha" | "numeroRepasse">) =>
  `${chaveDoProcedimento(r)}:${r.numeroRepasse}`;

export const semRepasseRepetido = (vindos: RegistroDeRepasse[]) => semRepetidosPorChave(vindos, chaveDoRepasse);

/**
 * Compara um mês de `dataRepasse` no Hub com o que veio do ProDoctor. Lote novo → novos;
 * lote editado → alterados; repasse estornado (sumiu do mês) → sumiram.
 */
export function diferencaDoMesDeRepasse(atuais: RepasseAtual[], vindos: RegistroDeRepasse[]): DiferencaDoMesDeRepasse {
  return diferencaPorChave(atuais, vindos, chaveDoRepasse, "repasses");
}
