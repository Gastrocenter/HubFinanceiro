import { ehDataIso, periodoDoAtalho } from "./periodo";

/**
 * Filtros das páginas de contas (issue 11, D-6 e D-7). Moram no endereço da página: painel, cabeçalho da
 * tabela e menu de categorias leem e escrevem o mesmo estado por `lerFiltros` e `filtrosParaBusca`.
 * Valor inválido nunca dá erro: cai no padrão, campo a campo.
 */

export const ABAS = ["stella", "sabin", "todas"] as const;
export type Aba = (typeof ABAS)[number];

/** Data do período: vencimento, entrada (`data_inclusao`) ou pagamento/recebimento (`data_efetivacao`). */
export const TIPOS_DE_DATA = ["vencimento", "entrada", "efetivacao"] as const;
export type TipoDeData = (typeof TIPOS_DE_DATA)[number];

/** Em aberto, paga/recebida, e vencida (em aberto com vencimento antes de hoje em São Paulo). */
export const SITUACOES = ["aberta", "efetivada", "vencida"] as const;
export type SituacaoDoFiltro = (typeof SITUACOES)[number];

export type FiltrosDeContas = {
  aba: Aba;
  de: string;
  ate: string;
  tipoDeData: TipoDeData;
  /** Vazio = todas as situações. Sempre na ordem de `SITUACOES`. */
  situacoes: SituacaoDoFiltro[];
  /** Vazio = todas as categorias. */
  categorias: string[];
  fornecedor: string | null;
};

/** O que o Next entrega em `searchParams`, ou um `URLSearchParams`. */
export type Busca = Record<string, string | string[] | undefined> | URLSearchParams;

const valores = (busca: Busca, chave: string): string[] => {
  if (busca instanceof URLSearchParams) return busca.getAll(chave);
  const v = busca[chave];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};
const primeiro = (busca: Busca, chave: string) => valores(busca, chave)[0];
const umDe = <T extends string>(opcoes: readonly T[], valor: string | undefined, padrao: T): T =>
  opcoes.includes(valor as T) ? (valor as T) : padrao;

const ABA_PADRAO: Aba = "stella";
const TIPO_DE_DATA_PADRAO: TipoDeData = "vencimento";

/** Lê os filtros do endereço. Padrão: aba Stella Central, este mês, por vencimento, sem outros filtros. */
export function lerFiltros(busca: Busca, hoje: string): FiltrosDeContas {
  const de = primeiro(busca, "de");
  const ate = primeiro(busca, "ate");
  const periodo =
    de !== undefined && ate !== undefined && ehDataIso(de) && ehDataIso(ate) && de <= ate
      ? { de, ate }
      : periodoDoAtalho("este-mes", hoje);
  const pedidas = valores(busca, "situacao");
  const fornecedor = primeiro(busca, "fornecedor")?.trim();
  return {
    aba: umDe(ABAS, primeiro(busca, "aba"), ABA_PADRAO),
    ...periodo,
    tipoDeData: umDe(TIPOS_DE_DATA, primeiro(busca, "data"), TIPO_DE_DATA_PADRAO),
    situacoes: SITUACOES.filter((s) => pedidas.includes(s)),
    categorias: [...new Set(valores(busca, "categoria").map((c) => c.trim()).filter(Boolean))],
    fornecedor: fornecedor ? fornecedor : null,
  };
}

const periodoEhPadrao = (f: FiltrosDeContas, hoje: string) => {
  const p = periodoDoAtalho("este-mes", hoje);
  return f.de === p.de && f.ate === p.ate;
};

/** Os filtros como query string (sem "?"), só com o que difere do padrão; o padrão vira "". */
export function filtrosParaBusca(f: FiltrosDeContas, hoje: string): string {
  const busca = new URLSearchParams();
  if (f.aba !== ABA_PADRAO) busca.set("aba", f.aba);
  if (!periodoEhPadrao(f, hoje)) {
    busca.set("de", f.de);
    busca.set("ate", f.ate);
  }
  if (f.tipoDeData !== TIPO_DE_DATA_PADRAO) busca.set("data", f.tipoDeData);
  for (const s of f.situacoes) busca.append("situacao", s);
  for (const c of f.categorias) busca.append("categoria", c);
  if (f.fornecedor) busca.set("fornecedor", f.fornecedor);
  return busca.toString();
}

/** Quantos filtros do painel estão fora do padrão, para o botão "Filtros · N". A aba não conta. */
export function filtrosLigados(f: FiltrosDeContas, hoje: string): number {
  return [
    !periodoEhPadrao(f, hoje),
    f.tipoDeData !== TIPO_DE_DATA_PADRAO,
    f.situacoes.length > 0,
    f.categorias.length > 0,
    f.fornecedor !== null,
  ].filter(Boolean).length;
}
