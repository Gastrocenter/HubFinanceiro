import { extrairRegistros } from "./resposta";

/** Faz um POST na API do ProDoctor e devolve o JSON da resposta. */
export type Transporte = (rota: string, corpo: Record<string, unknown>) => Promise<unknown>;

export type OpcoesDePaginacao = {
  /** Teto de segurança contra API que ignora a paginação. */
  maxPaginas?: number;
};

/** Busca página por página (campo `pagina`, a partir de 1) até vir uma página vazia. */
export async function coletarTodasPaginas(
  transporte: Transporte,
  rota: string,
  corpo: Record<string, unknown>,
  caminhoDaLista: string,
  { maxPaginas = 1000 }: OpcoesDePaginacao = {},
): Promise<unknown[]> {
  const todos: unknown[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const registros = extrairRegistros(await transporte(rota, { ...corpo, pagina }), caminhoDaLista);
    if (registros.length === 0) return todos;
    todos.push(...registros);
  }
  throw new Error(`${rota}: passou de ${maxPaginas} páginas sem terminar; a paginação pode estar sendo ignorada.`);
}
