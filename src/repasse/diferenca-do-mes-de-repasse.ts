import { chaveDoProcedimento } from "@/receita/diferenca-do-mes";
import { diferencaPorChave, semRepetidosPorChave, type Atual, type Diferenca } from "@/sync/diferenca-por-chave";
import type { RegistroDeRepasse } from "./ler-repasses";

export type RepasseAtual = Atual<RegistroDeRepasse>;
export type DiferencaDoMesDeRepasse = Diferenca<RegistroDeRepasse>;

/** A chave do procedimento repassado (unidade, conta, linha): a mesma do recebível, que liga os dois. */
export const chaveDoRepasse = (r: Pick<RegistroDeRepasse, "codigoLocal" | "conta" | "linha">) => chaveDoProcedimento(r);

export const semRepasseRepetido = (vindos: RegistroDeRepasse[]) => semRepetidosPorChave(vindos, chaveDoRepasse);

/**
 * Compara um mês de `dataRepasse` no Hub com o que veio do ProDoctor. Lote novo → novos;
 * lote editado → alterados; repasse estornado (sumiu do mês) → sumiram.
 */
export function diferencaDoMesDeRepasse(atuais: RepasseAtual[], vindos: RegistroDeRepasse[]): DiferencaDoMesDeRepasse {
  return diferencaPorChave(atuais, vindos, chaveDoRepasse, "repasses");
}
