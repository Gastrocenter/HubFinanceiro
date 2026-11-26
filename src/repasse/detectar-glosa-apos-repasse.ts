import { chaveDoProcedimento } from "@/receita/diferenca-do-mes";
import type { RegistroDeProcedimento } from "@/receita/ler-procedimentos";
import { somarValores, type ValorExato } from "@/dominio/valor";

/** O que o Hub sabe do repasse já feito sobre um procedimento. */
export type RepasseFeito = { numeroRepasse: string; dataRepasse: string; valorRepassadoMedico: ValorExato | null };

export type GlosaAposRepasse = {
  /**
   * Chave do procedimento mais os valores novos de glosa ("1:A:1|valorGlosa=45"): cada mudança é uma pendência,
   * e uma ainda aberta não engole a seguinte.
   */
  referencia: string;
  detalhes: RepasseFeito & { procedimento: string; glosa: Partial<Record<CampoDeGlosa, { antes: ValorExato | null; depois: ValorExato | null }>> };
};

const CAMPOS_DE_GLOSA = ["valorGlosa", "totalGlosasMateriaisMedicamentos", "totalGlosasTaxasDiarias"] as const;
type CampoDeGlosa = (typeof CAMPOS_DE_GLOSA)[number];

/** Forma canônica de um valor de glosa: vazio conta como zero e "30.00" como "30". */
const valorCanonico = (v: ValorExato | null) => somarValores([v ?? "0"]);

/**
 * Glosa nova ou alterada num procedimento que já tem repasse (L10, D-V). O Hub não desconta nada:
 * devolve a pendência com os valores para alguém decidir.
 */
export function detectarGlosaAposRepasse(
  alterados: readonly { antes: RegistroDeProcedimento; depois: RegistroDeProcedimento }[],
  repassados: ReadonlyMap<string, RepasseFeito>,
): GlosaAposRepasse[] {
  return alterados.flatMap(({ antes, depois }) => {
    const chave = chaveDoProcedimento(depois);
    const repasse = repassados.get(chave);
    if (!repasse) return [];
    const mudaram = CAMPOS_DE_GLOSA.filter((c) => valorCanonico(antes[c]) !== valorCanonico(depois[c]));
    if (mudaram.length === 0) return [];
    const glosa = Object.fromEntries(mudaram.map((c) => [c, { antes: antes[c], depois: depois[c] }]));
    const valoresNovos = mudaram.map((c) => `${c}=${valorCanonico(depois[c])}`).join(";");
    return [{ referencia: `${chave}|${valoresNovos}`, detalhes: { procedimento: chave, ...repasse, glosa } }];
  });
}
