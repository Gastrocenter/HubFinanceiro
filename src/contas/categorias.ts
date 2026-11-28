/**
 * Regras da tela Cadastros → Categorias (issue 11, D-3 e D-4): as categorias do Hub, separadas por natureza, e a
 * ligação de cada item do plano financeiro (sem o sufixo da unidade) a uma categoria.
 *
 * O banco repete as checagens (`salvar_categoria`, `definir_categoria_do_item`); aqui elas viram mensagem legível
 * antes de gravar.
 */
import { itemSemUnidade } from "./unidade-do-plano";

/** Lista de categorias: a pagar e a receber são separadas (D-3). */
export type Natureza = "pagar" | "receber";

export const NATUREZAS: readonly { valor: Natureza; rotulo: string }[] = [
  { valor: "pagar", rotulo: "A pagar" },
  { valor: "receber", rotulo: "A receber" },
];

/** Natureza do endereço ou do formulário; valor desconhecido cai em `pagar`. */
export function lerNatureza(valor: unknown): Natureza {
  return valor === "receber" ? "receber" : "pagar";
}

export const LIMITE_DO_NOME = 60;

export type Validado<T> = ({ ok: true } & T) | { ok: false; erro: string };

const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucn";

/**
 * Identificador da categoria no endereço ("Manutenção e exames" → "manutencao-e-exames").
 * ATENÇÃO: espelho de `slug_da_categoria` no banco (mesma tabela de acentos); as duas precisam bater.
 */
export function slugDaCategoria(nome: string): string {
  const semAcento = [...nome.trim().toLowerCase()].map((ch) => {
    const i = COM_ACENTO.indexOf(ch);
    return i >= 0 ? SEM_ACENTO[i] : ch;
  });
  return semAcento.join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Reservado para as contas cujo item não tem categoria (D-5). */
export const SLUG_SEM_CATEGORIA = "sem-categoria";

/**
 * Nome de categoria novo ou renomeado: sem espaço sobrando, até 60 caracteres, com letra ou número, e sem repetir o
 * identificador de outra categoria de qualquer das duas listas (o filtro das páginas é pelo identificador e uma página
 * mostra categorias das duas listas, D-3). `id` é a categoria sendo renomeada, que pode mudar só a grafia.
 */
export function validarNomeDeCategoria(
  nome: string,
  existentes: readonly { id: number; nome: string }[],
  id?: number,
): Validado<{ nome: string }> {
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (limpo === "") return { ok: false, erro: "Escreva o nome da categoria." };
  if (limpo.length > LIMITE_DO_NOME) return { ok: false, erro: `O nome pode ter até ${LIMITE_DO_NOME} caracteres.` };
  const slug = slugDaCategoria(limpo);
  if (slug === "") return { ok: false, erro: "O nome precisa ter letra ou número." };
  if (slug === SLUG_SEM_CATEGORIA) return { ok: false, erro: '"Sem categoria" é reservado.' };
  const repetida = existentes.find((c) => c.id !== id && slugDaCategoria(c.nome) === slug);
  if (repetida) return { ok: false, erro: `Já existe a categoria "${repetida.nome}".` };
  return { ok: true, nome: limpo };
}

export type CategoriaDaLista = { id: number; natureza: Natureza; nome: string };

/** Uma linha de `itens_para_categorizar` (SQL), já filtrada por natureza. */
export type ItemDoBanco = {
  item: string;
  /** Raízes do código do plano em que o item aparece ("1", "2", "3", "0"). */
  raizes: readonly string[];
  /** false: o item só aparece em conta (ex.: conta lançada direto num grupo, sem item). */
  no_plano: boolean;
  /** bigint do banco, que pode chegar como texto. */
  contas: number | string;
  categoria_id: number | null;
};

export type LinhaDeItem = {
  item: string;
  unidades: string;
  foraDoPlano: boolean;
  contas: number;
  categoriaId: number | null;
  /** `null` é "Sem categoria". */
  categoria: string | null;
};

const UNIDADE_DA_RAIZ: Record<string, string> = { "1": "Stella Central", "2": "Albert Sabin", "3": "TNI", "0": "Caixa" };
const ORDEM_DA_RAIZ = ["1", "2", "3", "0"];

function unidadesDe(raizes: readonly string[]): string {
  const posicao = (r: string) => (ORDEM_DA_RAIZ.includes(r) ? ORDEM_DA_RAIZ.indexOf(r) : ORDEM_DA_RAIZ.length);
  return [...new Set(raizes)]
    .sort((a, b) => posicao(a) - posicao(b) || a.localeCompare(b))
    .map((r) => UNIDADE_DA_RAIZ[r] ?? `raiz ${r}`)
    .join(", ");
}

/**
 * Itens prontos para a tela: os sem categoria primeiro (são o que precisa de atenção), depois os mais usados.
 * O resumo conta os sem categoria e as contas que caem neles.
 */
export function montarItens(
  itens: readonly ItemDoBanco[],
  categorias: readonly CategoriaDaLista[],
): { linhas: LinhaDeItem[]; resumo: { itens: number; semCategoria: number; contasSemCategoria: number } } {
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const linhas = itens
    .map((i) => {
      const categoria = i.categoria_id === null ? null : (nomes.get(i.categoria_id) ?? null);
      return {
        item: i.item,
        unidades: unidadesDe(i.raizes),
        foraDoPlano: !i.no_plano,
        contas: Number(i.contas),
        categoriaId: categoria === null ? null : i.categoria_id,
        categoria,
      };
    })
    .sort(
      (a, b) =>
        Number(a.categoria !== null) - Number(b.categoria !== null) || b.contas - a.contas || a.item.localeCompare(b.item, "pt-BR"),
    );
  const sem = linhas.filter((l) => l.categoria === null);
  return {
    linhas,
    resumo: { itens: linhas.length, semCategoria: sem.length, contasSemCategoria: sem.reduce((t, l) => t + l.contas, 0) },
  };
}

/**
 * Troca da categoria de um item, como chega do formulário. `categoria` vazia tira a ligação (o item volta a
 * "Sem categoria", D-5). O item já vem sem sufixo: a ligação vale para as três raízes.
 */
export function validarTrocaDeCategoria(
  entrada: { natureza: unknown; item: unknown; categoria: unknown },
  categorias: readonly CategoriaDaLista[],
): Validado<{ natureza: Natureza; item: string; categoriaId: number | null }> {
  if (entrada.natureza !== "pagar" && entrada.natureza !== "receber") return { ok: false, erro: "Natureza inválida." };
  const natureza = entrada.natureza;
  const item = typeof entrada.item === "string" ? entrada.item : "";
  if (item.trim() === "" || item !== itemSemUnidade(item)) return { ok: false, erro: "Item inválido." };

  const categoria = typeof entrada.categoria === "string" ? entrada.categoria : "";
  if (categoria === "") return { ok: true, natureza, item, categoriaId: null };
  const id = /^\d+$/.test(categoria) ? Number(categoria) : NaN;
  const existe = categorias.some((c) => c.id === id && c.natureza === natureza);
  if (!existe) return { ok: false, erro: `Essa categoria não existe na lista ${natureza === "pagar" ? "a pagar" : "a receber"}.` };
  return { ok: true, natureza, item, categoriaId: id };
}
