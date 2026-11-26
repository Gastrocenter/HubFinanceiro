export type ResultadoDoNome = { tipo: "casou"; id: number } | { tipo: "ambiguo"; ids: number[] } | { tipo: "nao_encontrado" };

/** Casa o nome de uma exportação com o cadastro pelo nome exato (D-I). Nunca escolhe entre homônimos. */
export function resolverPorNome(nome: string, cadastros: readonly { id: number; nome: string }[]): ResultadoDoNome {
  if (!nome) return { tipo: "nao_encontrado" };
  const ids = cadastros.filter((c) => c.nome === nome).map((c) => c.id);
  if (ids.length === 1) return { tipo: "casou", id: ids[0] };
  if (ids.length > 1) return { tipo: "ambiguo", ids };
  return { tipo: "nao_encontrado" };
}
