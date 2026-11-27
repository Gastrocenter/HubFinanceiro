/**
 * Unidade e item de uma conta, lidos do plano financeiro do ProDoctor (issue 11, D-2 e D-3).
 *
 * Toda conta está no local ProDoctor Stella Central, inclusive as da Sabin: a unidade só aparece na raiz do
 * código do plano (`raiz.natureza.grupo.item`). E cada item se repete por raiz com o sufixo da unidade.
 *
 * ATENÇÃO: as funções SQL `unidade_do_plano` e `item_sem_unidade` (migration `*_categorias_do_hub.sql`) são o
 * espelho destas e precisam bater. Mudou aqui, muda lá, e vice-versa; os mesmos casos estão em
 * `supabase/tests/categorias.sql`.
 */

/** Aba em que a conta aparece; `caixa` (raiz 0 ou desconhecida) só aparece em "Todas". */
export type UnidadeDoPlano = "stella" | "sabin" | "caixa";

/** Raiz `1` (Stella Central) e `3` (TNI) → Stella Central; `2` → Albert Sabin; `0` ou outra → caixa. */
export function unidadeDoPlano(codigo: string | null): UnidadeDoPlano {
  const raiz = (codigo ?? "").trim().split(".")[0];
  if (raiz === "1" || raiz === "3") return "stella";
  if (raiz === "2") return "sabin";
  return "caixa";
}

const SUFIXO_DA_UNIDADE = /\s*\(\s*(?:stella|sabin|tni)\s*\)\s*$/i;

/** "Taxa de Cartão sobre a Venda (SABIN)" → "Taxa de Cartão sobre a Venda": só o último sufixo, só no fim. */
export function itemSemUnidade(nome: string): string {
  return nome.replace(SUFIXO_DA_UNIDADE, "").trim();
}
