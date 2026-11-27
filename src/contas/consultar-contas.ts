import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "@/lib/ler-tudo";
import type { FiltrosDeContas } from "./filtros";

export type Natureza = "pagar" | "receber";

/** Uma linha da tabela (D-9). Dinheiro em texto exato (ADR-0004); paciente vem só como "Paciente" (ADR-0005). */
export type LinhaDeConta = {
  id: number;
  codigo_local: string;
  numero: string;
  data_inclusao: string | null;
  data_vencimento: string | null;
  data_efetivacao: string | null;
  situacao: string;
  vencida: boolean;
  fornecedor: string | null;
  categoria_id: number | null;
  categoria: string;
  categoria_slug: string;
  item: string;
  valor: string;
  efetivado: string;
};

export type TotaisDeContas = { contas: number; em_aberto: string; vencido: string; efetivado: string };

/** Menu de categorias (D-8): a linha da categoria tem `item` nulo e vem antes das linhas dos seus itens. */
export type LinhaDoResumo = {
  ordem: number;
  categoria_id: number | null;
  categoria: string;
  categoria_slug: string;
  item: string | null;
  contas: number;
  em_aberto: string;
  efetivado: string;
};

const parametros = (natureza: Natureza, f: FiltrosDeContas) => ({
  p_natureza: natureza,
  p_aba: f.aba,
  p_de: f.de,
  p_ate: f.ate,
  p_tipo_data: f.tipoDeData,
  p_situacoes: f.situacoes,
  p_categorias: f.categorias,
  p_fornecedor: f.fornecedor,
});

/** Lista, cartões e menu de categorias de uma página, todos sobre os mesmos filtros (S4). */
export async function consultarContas(db: SupabaseClient, natureza: Natureza, f: FiltrosDeContas) {
  const p = parametros(natureza, f);
  // O menu de categorias ignora o filtro de categoria: senão, marcar uma escondia as outras do próprio menu.
  const semCategoria = { ...p, p_categorias: [] };
  const [linhas, totais, resumo] = await Promise.all([
    // Página a página: o PostgREST corta uma resposta em 1000 linhas. A ordem vem do SQL.
    lerTudo((de, ate) => db.rpc("listar_contas", p).range(de, ate), `listar contas a ${natureza}`),
    db.rpc("totais_contas_filtradas", p).single(),
    db.rpc("resumo_por_categoria", semCategoria),
  ]);
  if (totais.error) throw new Error(`totais de contas a ${natureza}: ${totais.error.message}`);
  if (resumo.error) throw new Error(`resumo por categoria a ${natureza}: ${resumo.error.message}`);
  return {
    linhas: linhas as LinhaDeConta[],
    totais: totais.data as TotaisDeContas,
    resumo: (resumo.data ?? []) as LinhaDoResumo[],
  };
}
