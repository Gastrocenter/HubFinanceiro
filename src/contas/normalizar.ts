import type { SupabaseClient } from "@supabase/supabase-js";
import { mesDoCorpo } from "@/receita/normalizar";
import { lerTudo } from "@/lib/ler-tudo";
import { diferencaDoMesDeContas, type ContaAtual } from "./diferenca-do-mes-de-contas";
import { lerContas, type RegistroDeConta } from "./ler-contas";
import { lerPlanoFinanceiro, ROTAS_DO_PLANO, type TipoDoPlano } from "./ler-plano-financeiro";

export const ROTA_CONTAS = "/api/v1/Exportacoes/ContasPagarReceber";

const CAMPOS_DO_BANCO: Record<keyof RegistroDeConta, string> = {
  codigoLocal: "codigo_local", numero: "numero", lancamentoFinanceiro: "lancamento_financeiro",
  contaPagarReceberPai: "conta_pagar_receber_pai", dataInclusao: "data_inclusao", dataEfetivacao: "data_efetivacao",
  dataVencimento: "data_vencimento", dataCompensacao: "data_compensacao", situacao: "situacao",
  tipoClienteFornecedor: "tipo_cliente_fornecedor", clienteFornecedor: "cliente_fornecedor", historico: "historico",
  numeroDocumento: "numero_documento", creditoValor: "credito_valor", creditoValorEfetivacao: "credito_valor_efetivacao",
  debitoValor: "debito_valor", debitoValorEfetivacao: "debito_valor_efetivacao", percentualTaxa: "percentual_taxa",
  grupoReceitaDespesa: "grupo_receita_despesa", nomeGrupoReceitaDespesa: "nome_grupo_receita_despesa",
  contaContabil: "conta_contabil", nomeContaContabil: "nome_conta_contabil", contaContabilEfetivacao: "conta_contabil_efetivacao",
  nomeContaContabilEfetivacao: "nome_conta_contabil_efetivacao", formaEfetivacao: "forma_efetivacao", conta: "conta",
  fatura: "fatura", numRepasse: "num_repasse",
};

const NUMERICOS = new Set(["credito_valor", "credito_valor_efetivacao", "debito_valor", "debito_valor_efetivacao", "percentual_taxa"]);

/** `numeric` e `date` vêm como texto: como número JSON perderiam casas e todo dia pareceriam "alterados" (ADR-0004). */
const SELECT_CONTAS = [
  ...Object.values(CAMPOS_DO_BANCO).map((c) => (NUMERICOS.has(c) || c.startsWith("data_") ? `${c}:${c}::text` : c)),
  "visto_na_ultima_sync",
].join(",");

const paraBanco = (c: RegistroDeConta) =>
  Object.fromEntries(Object.entries(CAMPOS_DO_BANCO).map(([ts, sql]) => [sql, c[ts as keyof RegistroDeConta]]));

const doBanco = (linha: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(CAMPOS_DO_BANCO).map(([ts, sql]) => [ts, linha[sql] ?? null])) as RegistroDeConta;

const lerPaginas = (db: SupabaseClient, jobId: string) =>
  lerTudo(
    (de, ate) => db.from("prodoctor_payload_bruto").select("payload").eq("job_id", Number(jobId)).order("pagina").range(de, ate),
    `ler páginas do job ${jobId}`,
  );

/**
 * Lê as páginas de um job de contas (um mês de inclusão, D-2), compara com o mês no Hub e aplica numa transação.
 * Sem dado de paciente (D-1): o parser já não deixa passar, e o banco recusa se passar.
 */
export async function normalizarContasDoJob(db: SupabaseClient, job: { id: string; empresa: string; corpo: Record<string, unknown> }) {
  const mes = mesDoCorpo(job.corpo);
  const todas = (await lerPaginas(db, job.id)).flatMap((p) => lerContas(p.payload));
  const vindas = todas.filter((c) => c.dataInclusao.startsWith(mes));

  const linhas = (await lerTudo(
    (de, ate) => db.from("contas_pagar_receber").select(SELECT_CONTAS).eq("empresa", job.empresa).eq("mes", mes).order("id").range(de, ate),
    `ler contas de ${mes}`,
  )) as unknown as Record<string, unknown>[];
  const atuais: ContaAtual[] = linhas.map((l) => ({ registro: doBanco(l), vistoNaUltimaSync: Boolean(l.visto_na_ultima_sync) }));

  const dif = diferencaDoMesDeContas(atuais, vindas);
  const gravar = [...dif.novos, ...dif.alterados.map((a) => a.registro)].map(paraBanco);

  const { error } = await db.rpc("aplicar_mes_de_contas", {
    p_empresa: job.empresa,
    p_mes: mes,
    p_diferenca: { gravar, sumiram: dif.sumiram, voltaram: dif.voltaram },
  });
  if (error) throw new Error(`aplicar contas de ${mes}: ${error.message}`);

  return {
    mes,
    linhas: vindas.length,
    foraDoMes: todas.length - vindas.length,
    novos: dif.novos.length,
    alterados: dif.alterados.length,
    sumiram: dif.sumiram.length,
    voltaram: dif.voltaram.length,
  };
}

const TIPO_DA_ROTA = Object.fromEntries(Object.entries(ROTAS_DO_PLANO).map(([tipo, { rota }]) => [rota, tipo as TipoDoPlano]));

/** Grupos de receita/despesa e contas contábeis (D-4): a lista inteira de um tipo, aplicada de uma vez. */
export async function normalizarPlanoDoJob(db: SupabaseClient, job: { id: string; empresa: string; rota: string }) {
  const tipo = TIPO_DA_ROTA[job.rota];
  if (!tipo) throw new Error(`${job.rota} não é do plano financeiro.`);
  const itens = (await lerPaginas(db, job.id)).flatMap((p) => lerPlanoFinanceiro(p.payload, tipo));
  const { error } = await db.rpc("aplicar_plano_financeiro", {
    p_empresa: job.empresa,
    p_tipo: tipo,
    p_itens: itens.map((i) => ({
      codigo: i.codigo, nome: i.nome, permite_lancamento: i.permiteLancamento, inclui_balancete: i.incluiBalancete,
      estado_registro: i.estadoRegistro,
    })),
  });
  if (error) throw new Error(`aplicar plano financeiro (${tipo}): ${error.message}`);
  return { tipo, itens: itens.length };
}
