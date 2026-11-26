import type { SupabaseClient } from "@supabase/supabase-js";
import { diferencaDoMes, type ProcedimentoAtual } from "./diferenca-do-mes";
import { lerProcedimentos, type RegistroDeProcedimento } from "./ler-procedimentos";
import { resolverPorNome } from "./resolver-por-nome";
import { lerTudo } from "@/lib/ler-tudo";

export const ROTA_PROCEDIMENTOS = "/api/v1/Exportacoes/ProcedimentosContasPacientes";

/** "dd/mm/aaaa" do corpo do job → "aaaa-mm". */
export function mesDoCorpo(corpo: Record<string, unknown>): string {
  const inicial = (corpo.periodo as { dataInicial?: string } | undefined)?.dataInicial ?? "";
  const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(inicial);
  if (!m) throw new Error(`Job de procedimentos sem período válido: "${inicial}".`);
  return `${m[2]}-${m[1]}`;
}

type Origem = { codigo_origem: string; nome_origem: string; unidade_id: number | null; profissional_id: number | null; convenio_id: number | null };

const CAMPOS_DO_BANCO: Record<keyof RegistroDeProcedimento, string> = {
  codigoLocal: "codigo_local", conta: "conta", linha: "linha", fatura: "fatura", data: "data",
  nomeProfissional: "nome_profissional_origem", nomeConvenio: "nome_convenio_origem", funcao: "funcao",
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
  const atuais: ProcedimentoAtual[] = (linhasDoMes as unknown as Record<string, unknown>[]).map((l) => ({
    registro: doBanco(l),
    vistoNaUltimaSync: Boolean(l.visto_na_ultima_sync),
  }));

  const dif = diferencaDoMes(atuais, vindos);

  const origens = await lerTudo(
    (de, ate) =>
      db.from("de_para").select("tipo, codigo_origem, nome_origem, unidade_id, profissional_id, convenio_id").eq("empresa", job.empresa).order("id").range(de, ate),
    "ler de-para",
  );
  const doTipo = (tipo: string) => origens.filter((o) => o.tipo === tipo) as (Origem & { tipo: string })[];
  const profissionais = doTipo("profissional").map((o) => ({ id: o.profissional_id!, nome: o.nome_origem }));
  const convenios = doTipo("convenio").map((o) => ({ id: o.convenio_id!, nome: o.nome_origem }));
  const unidades = new Map(doTipo("unidade").map((o) => [o.codigo_origem, o.unidade_id!]));

  const pendencias = new Map<string, { tipo: string; referencia: string; descricao: string; detalhes: Record<string, unknown> }>();
  function vincular(nome: string, cadastros: { id: number; nome: string }[], qual: "profissional" | "convenio"): number | null {
    const r = resolverPorNome(nome, cadastros);
    if (r.tipo === "casou") return r.id;
    const tipo = r.tipo === "ambiguo" ? `${qual}_ambiguo` : `${qual}_sem_par`;
    pendencias.set(`${tipo}:${nome}`, {
      tipo,
      referencia: nome,
      descricao: r.tipo === "ambiguo" ? `Nome de ${qual} casa com mais de um cadastro` : `Nome de ${qual} sem cadastro no de-para`,
      detalhes: { mes, ...(r.tipo === "ambiguo" ? { candidatos: r.ids } : {}) },
    });
    return null;
  }

  const gravar = [...dif.novos, ...dif.alterados.map((a) => a.registro)].map((r) => {
    const unidade = unidades.get(r.codigoLocal) ?? null;
    if (unidade === null) {
      pendencias.set(`unidade_sem_par:${r.codigoLocal}`, {
        tipo: "unidade_sem_par", referencia: r.codigoLocal, descricao: "Código de unidade sem de-para", detalhes: { mes },
      });
    }
    return {
      ...paraBanco(r),
      unidade_id: unidade,
      profissional_id: vincular(r.nomeProfissional, profissionais, "profissional"),
      convenio_id: vincular(r.nomeConvenio, convenios, "convenio"),
    };
  });

  const { error: e4 } = await db.rpc("aplicar_mes_de_procedimentos", {
    p_empresa: job.empresa,
    p_mes: mes,
    p_diferenca: { gravar, sumiram: dif.sumiram, voltaram: dif.voltaram, pendencias: [...pendencias.values()] },
  });
  if (e4) throw new Error(`aplicar mês ${mes}: ${e4.message}`);

  return {
    mes,
    linhas: vindos.length,
    foraDoMes: todos.length - vindos.length,
    novos: dif.novos.length,
    alterados: dif.alterados.length,
    sumiram: dif.sumiram.length,
    voltaram: dif.voltaram.length,
    pendencias: pendencias.size,
  };
}
