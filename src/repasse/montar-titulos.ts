import { arredondarParaCentavos } from "@/dominio/formatar-reais";
import { somarValores, type ValorExato } from "@/dominio/valor";
import type { RegistroDeRepasse } from "./ler-repasses";

/** O que um título precisa de cada linha de repasse. */
export type LinhaDoTitulo = Pick<RegistroDeRepasse, "numeroRepasse" | "nomeProfissional" | "dataRepasse" | "valorRepassadoMedico"> & {
  profissionalId: number | null;
};

/** Título a pagar ao profissional: um por (profissional, lote do ProDoctor) — D1. */
export type Titulo = {
  numeroRepasse: string;
  nomeProfissional: string;
  profissionalId: number | null;
  /** Referência do título (D1). */
  dataRepasse: string;
  linhas: number;
  /** Soma exata de `valorRepassadoMedico` (D2). */
  totalExato: ValorExato;
  /** Arredondado uma vez, no total (D-T, ADR-0004). */
  totalCentavos: bigint;
};

/** Agrupa as linhas por (profissional, lote), soma exato e só então arredonda. Ordem: a da primeira linha de cada grupo. */
export function montarTitulos(linhas: readonly LinhaDoTitulo[]): Titulo[] {
  const grupos = new Map<string, LinhaDoTitulo[]>();
  for (const l of linhas) {
    const chave = JSON.stringify([l.numeroRepasse, l.nomeProfissional]);
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }
  return [...grupos.values()].map((grupo) => {
    const [primeira] = grupo;
    const datas = new Set(grupo.map((l) => l.dataRepasse));
    if (datas.size > 1) throw new Error(`Lote ${primeira.numeroRepasse} com mais de uma dataRepasse: ${[...datas].join(", ")}.`);
    const valores = grupo.map((l) => {
      if (l.valorRepassadoMedico === null) throw new Error(`Lote ${l.numeroRepasse} com linha sem valorRepassadoMedico.`);
      return l.valorRepassadoMedico;
    });
    const totalExato = somarValores(valores);
    return {
      numeroRepasse: primeira.numeroRepasse,
      nomeProfissional: primeira.nomeProfissional,
      profissionalId: primeira.profissionalId,
      dataRepasse: primeira.dataRepasse,
      linhas: grupo.length,
      totalExato,
      totalCentavos: arredondarParaCentavos(totalExato),
    };
  });
}
