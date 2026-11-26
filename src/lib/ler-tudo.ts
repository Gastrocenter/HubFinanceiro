/** Tamanho de página: o PostgREST do Supabase devolve no máximo 1000 linhas por consulta. */
export const LINHAS_POR_PAGINA = 1000;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Lê todas as linhas de uma consulta, página por página. `consulta(de, ate)` deve aplicar `.range(de, ate)`
 * com uma ordenação estável (ex.: por id), senão linhas podem pular ou repetir entre páginas.
 */
export async function lerTudo<T>(consulta: (de: number, ate: number) => Pagina<T>, contexto: string): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += LINHAS_POR_PAGINA) {
    const { data, error } = await consulta(de, de + LINHAS_POR_PAGINA - 1);
    if (error) throw new Error(`${contexto}: ${error.message}`);
    todas.push(...(data ?? []));
    if (!data || data.length < LINHAS_POR_PAGINA) return todas;
  }
}
