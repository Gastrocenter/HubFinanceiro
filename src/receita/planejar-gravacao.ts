import { semRepetidosPorChave, type Diferenca } from "@/sync/diferenca-por-chave";

export type Vinculos = { unidade_id: number | null; profissional_id: number | null; convenio_id: number | null };

const mesmosVinculos = (a: Vinculos, b: Vinculos) =>
  a.unidade_id === b.unidade_id && a.profissional_id === b.profissional_id && a.convenio_id === b.convenio_id;

type ComChave = { codigoLocal: string; conta: string; linha: string };

/**
 * Linhas a gravar: as novas e alteradas no ProDoctor, mais as que não mudaram lá mas cujo vínculo
 * com o de-para mudou (ex.: o cadastro do profissional passou a existir). Sem isso, a linha que
 * entrou sem vínculo ficaria assim para sempre. Serve a procedimentos e repasses; cada um passa a sua `chave`
 * (a do repasse inclui o lote).
 */
export function planejarGravacao<T extends ComChave>({
  vindos,
  diferenca,
  vinculosAtuais,
  vincular,
  chave,
}: {
  vindos: T[];
  diferenca: Diferenca<T>;
  vinculosAtuais: Map<string, Vinculos>;
  vincular: (r: T) => Vinculos;
  chave: (r: T) => string;
}): { registro: T; vinculos: Vinculos }[] {
  const mudaramNoProDoctor = new Set([...diferenca.novos, ...diferenca.alterados.map((a) => a.registro)].map(chave));
  return semRepetidosPorChave(vindos, chave).flatMap((registro) => {
    const k = chave(registro);
    const vinculos = vincular(registro);
    const atual = vinculosAtuais.get(k);
    const gravar = mudaramNoProDoctor.has(k) || (atual !== undefined && !mesmosVinculos(atual, vinculos));
    return gravar ? [{ registro, vinculos }] : [];
  });
}
