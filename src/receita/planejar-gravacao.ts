import { semRepetidosPorChave, type Diferenca } from "@/sync/diferenca-por-chave";
import { chaveDoProcedimento } from "./diferenca-do-mes";

export type Vinculos = { unidade_id: number | null; profissional_id: number | null; convenio_id: number | null };

const mesmosVinculos = (a: Vinculos, b: Vinculos) =>
  a.unidade_id === b.unidade_id && a.profissional_id === b.profissional_id && a.convenio_id === b.convenio_id;

type ComChave = { codigoLocal: string; conta: string; linha: string };

/**
 * Linhas a gravar: as novas e alteradas no ProDoctor, mais as que não mudaram lá mas cujo vínculo
 * com o de-para mudou (ex.: o cadastro do profissional passou a existir). Sem isso, a linha que
 * entrou sem vínculo ficaria assim para sempre. Serve a procedimentos e repasses (mesma chave).
 */
export function planejarGravacao<T extends ComChave>({
  vindos,
  diferenca,
  vinculosAtuais,
  vincular,
}: {
  vindos: T[];
  diferenca: Diferenca<T>;
  vinculosAtuais: Map<string, Vinculos>;
  vincular: (r: T) => Vinculos;
}): { registro: T; vinculos: Vinculos }[] {
  const mudaramNoProDoctor = new Set([...diferenca.novos, ...diferenca.alterados.map((a) => a.registro)].map(chaveDoProcedimento));
  return semRepetidosPorChave(vindos, chaveDoProcedimento).flatMap((registro) => {
    const chave = chaveDoProcedimento(registro);
    const vinculos = vincular(registro);
    const atual = vinculosAtuais.get(chave);
    const gravar = mudaramNoProDoctor.has(chave) || (atual !== undefined && !mesmosVinculos(atual, vinculos));
    return gravar ? [{ registro, vinculos }] : [];
  });
}
