import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveDoProcedimento, diferencaDoMes, type ProcedimentoAtual } from "./diferenca-do-mes";
import { lerProcedimentos, type RegistroDeProcedimento } from "./ler-procedimentos";
import { planejarGravacao } from "./planejar-gravacao";
import { criarVinculador, lerOrigens } from "@/sync/vinculador";
import { glosasAposRepasse } from "@/repasse/glosas-apos-repasse";
import { lerTudo } from "@/lib/ler-tudo";

export const ROTA_PROCEDIMENTOS = "/api/v1/Exportacoes/ProcedimentosContasPacientes";

/** "dd/mm/aaaa" do corpo do job → "aaaa-mm". */
export function mesDoCorpo(corpo: Record<string, unknown>): string {
  const inicial = (corpo.periodo as { dataInicial?: string } | undefined)?.dataInicial ?? "";
  const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(inicial);
  if (!m) throw new Error(`Job de procedimentos sem período válido: "${inicial}".`);
  return `${m[2]}-${m[1]}`;
}

const CAMPOS_DO_BANCO: Record<keyof RegistroDeProcedimento, string> = {
  codigoLocal: "codigo_local", conta: "conta", linha: "linha", fatura: "fatura", data: "data",
  nomeProfissional: "nome_profissional_origem", nomeConvenio: "nome_convenio_origem", especialidade: "especialidade_profissional", funcao: "funcao",
  funcaoRepasse: "funcao_repasse", codigoProcedimento: "codigo_procedimento", descricaoProcedimento: "descricao_procedimento",
  tipoProcedimento: "tipo_procedimento", grupoProcedimentosRepasses: "grupo_procedimentos_repasses", quantidade: "quantidade",
  valorTotal: "valor_total", valorDiferenca: "valor_diferenca", valorGlosa: "valor_glosa", valorRecuperado: "valor_recuperado",
  totalMateriaisMedicamentos: "total_materiais_medicamentos", totalTaxasDiarias: "total_taxas_diarias",
  totalGlosasMateriaisMedicamentos: "total_glosas_materiais_medicamentos", totalGlosasTaxasDiarias: "total_glosas_taxas_diarias",
  totalRecuperadoMateriaisMedicamentos: "total_recuperado_materiais_medicamentos",
  totalRecuperadoTaxasDiarias: "total_recuperado_taxas_diarias", naoRepassar: "nao_repassar", somenteRepasse: "somente_repasse",
  naoIncluirRepasse: "nao_incluir_repasse",
};

function paraBanco(r: RegistroDeProcedimento) {
  return Object.fromEntries(Object.entries(CAMPOS_DO_BANCO).map(([ts, sql]) => [sql, r[ts as keyof RegistroDeProcedimento]]));
}

const NUMERICOS = new Set([
  "quantidade", "valor_total", "valor_diferenca", "valor_glosa", "valor_recuperado", "total_materiais_medicamentos",
  "total_taxas_diarias", "total_glosas_materiais_medicamentos", "total_glosas_taxas_diarias",
  "total_recuperado_materiais_medicamentos", "total_recuperado_taxas_diarias",
]);

/**
 * Colunas para ler do banco. `numeric` vem como texto (`::text`): como número JSON, o JavaScript
 * perderia casas decimais e todo dia pareceria "alterado" (ADR-0004).
 */
const SELECT_RECEBIVEIS = [
  ...Object.values(CAMPOS_DO_BANCO).map((c) => (NUMERICOS.has(c) ? `${c}:${c}::text` : c)),
  "visto_na_ultima_sync",
  "unidade_id",
  "profissional_id",
  "convenio_id",
].join(",");

function doBanco(linha: Record<string, unknown>): RegistroDeProcedimento {
  return Object.fromEntries(Object.entries(CAMPOS_DO_BANCO).map(([ts, sql]) => [ts, linha[sql]])) as RegistroDeProcedimento;
}

/**
 * Lê as páginas de um job de procedimentos, compara com o mês no Hub, resolve nomes pelo de-para (D-I)
 * e aplica tudo numa transação. Nome sem par: a linha entra sem vínculo e vira pendência (D-S).
 */
export async function normalizarProcedimentosDoJob(
  db: SupabaseClient,
  job: { id: string; empresa: string; corpo: Record<string, unknown> },
) {
  const mes = mesDoCorpo(job.corpo);

  const paginas = await lerTudo(
    (de, ate) => db.from("prodoctor_payload_bruto").select("payload").eq("job_id", Number(job.id)).order("pagina").range(de, ate),
    `ler páginas do job ${job.id}`,
  );
  const todos = paginas.flatMap((p) => lerProcedimentos(p.payload));
  const vindos = todos.filter((r) => r.data.startsWith(mes));

  const linhasDoMes = await lerTudo(
    (de, ate) => db.from("recebiveis").select(SELECT_RECEBIVEIS).eq("empresa", job.empresa).eq("mes", mes).order("id").range(de, ate),
    `ler recebíveis de ${mes}`,
  );
  const linhas = linhasDoMes as unknown as Record<string, unknown>[];
  const atuais: ProcedimentoAtual[] = linhas.map((l) => ({ registro: doBanco(l), vistoNaUltimaSync: Boolean(l.visto_na_ultima_sync) }));
  const vinculosAtuais = new Map(
    linhas.map((l) => [
      chaveDoProcedimento(doBanco(l)),
      { unidade_id: l.unidade_id as number | null, profissional_id: l.profissional_id as number | null, convenio_id: l.convenio_id as number | null },
    ]),
  );

  const dif = diferencaDoMes(atuais, vindos);

  const vinculador = criarVinculador(await lerOrigens(db, job.empresa), mes);
  const glosas = await glosasAposRepasse(db, job.empresa, dif, atuais);

  // Regrava o que mudou no ProDoctor e também o que só mudou de vínculo (ex.: cadastro que passou a existir).
  const gravar = planejarGravacao({ vindos, diferenca: dif, vinculosAtuais, vincular: vinculador.vincular }).map(({ registro, vinculos }) => ({
    ...paraBanco(registro),
    ...vinculos,
  }));
  const religados = gravar.length - dif.novos.length - dif.alterados.length;

  const { error: e4 } = await db.rpc("aplicar_mes_de_procedimentos", {
    p_empresa: job.empresa,
    p_mes: mes,
    p_diferenca: {
      gravar,
      sumiram: dif.sumiram,
      voltaram: dif.voltaram,
      pendencias: [...vinculador.pendencias(), ...glosas.map((g) => ({ tipo: "glosa_apos_repasse", descricao: "Glosa nova ou alterada em procedimento já repassado", ...g }))],
      resolver: vinculador.resolver(),
    },
  });
  if (e4) throw new Error(`aplicar mês ${mes}: ${e4.message}`);

  return {
    mes,
    linhas: vindos.length,
    foraDoMes: todos.length - vindos.length,
    novos: dif.novos.length,
    alterados: dif.alterados.length,
    religados,
    sumiram: dif.sumiram.length,
    voltaram: dif.voltaram.length,
    pendencias: vinculador.pendencias().length,
    glosasAposRepasse: glosas.length,
  };
}

