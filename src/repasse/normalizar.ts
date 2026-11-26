import type { SupabaseClient } from "@supabase/supabase-js";
import { mesDoCorpo } from "@/receita/normalizar";
import { planejarGravacao, type Vinculos } from "@/receita/planejar-gravacao";
import { lerTudo } from "@/lib/ler-tudo";
import { criarVinculador, lerOrigens } from "@/sync/vinculador";
import { chaveDoRepasse, diferencaDoMesDeRepasse, semRepasseRepetido, type RepasseAtual } from "./diferenca-do-mes-de-repasse";
import { lerRepasses, type RegistroDeRepasse } from "./ler-repasses";
import { montarTitulos } from "./montar-titulos";

export const ROTA_REPASSES = "/api/v1/Exportacoes/Repasses";

const CAMPOS_DO_BANCO: Record<keyof RegistroDeRepasse, string> = {
  codigoLocal: "codigo_local", conta: "conta", linha: "linha", numeroRepasse: "numero_repasse", dataRepasse: "data_repasse",
  data: "data", fatura: "fatura", tipo: "tipo", nomeProfissional: "nome_profissional_origem", nomeConvenio: "nome_convenio_origem",
  codigoProcedimento: "codigo_procedimento", descricaoProcedimento: "descricao_procedimento", funcaoRepasse: "funcao_repasse",
  percentualImposto: "percentual_imposto", totalConta: "total_conta", baseCalculoBruto: "base_calculo_bruto",
  valorImposto: "valor_imposto", baseCalculoLiquido: "base_calculo_liquido", valorRepassado: "valor_repassado",
  valorRepassadoMedico: "valor_repassado_medico", valorRepassadoClinica: "valor_repassado_clinica",
};

const NUMERICOS = new Set([
  "percentual_imposto", "total_conta", "base_calculo_bruto", "valor_imposto", "base_calculo_liquido", "valor_repassado",
  "valor_repassado_medico", "valor_repassado_clinica",
]);

/** `numeric` vem como texto (`::text`): como número JSON perderia casas e todo dia pareceria "alterado" (ADR-0004). */
const SELECT_REPASSES = [
  ...Object.values(CAMPOS_DO_BANCO).map((c) => (NUMERICOS.has(c) ? `${c}:${c}::text` : c)),
  "visto_na_ultima_sync",
  "unidade_id",
  "profissional_id",
  "convenio_id",
].join(",");

const paraBanco = (r: RegistroDeRepasse) =>
  Object.fromEntries(Object.entries(CAMPOS_DO_BANCO).map(([ts, sql]) => [sql, r[ts as keyof RegistroDeRepasse]]));

const doBanco = (linha: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(CAMPOS_DO_BANCO).map(([ts, sql]) => [ts, linha[sql]])) as RegistroDeRepasse;

/**
 * Lê as páginas de um job de repasses (um mês de `dataRepasse`, D-X), compara com o mês no Hub, liga ao de-para
 * pelo nome (D-I), monta os títulos por (profissional, lote) e aplica tudo numa transação. O vínculo com o
 * recebível e as pendências de repasse sem procedimento (D-W) ficam no banco, que conhece os recebíveis.
 */
export async function normalizarRepassesDoJob(db: SupabaseClient, job: { id: string; empresa: string; corpo: Record<string, unknown> }) {
  const mes = mesDoCorpo(job.corpo);

  const paginas = await lerTudo(
    (de, ate) => db.from("prodoctor_payload_bruto").select("payload").eq("job_id", Number(job.id)).order("pagina").range(de, ate),
    `ler páginas do job ${job.id}`,
  );
  const todos = paginas.flatMap((p) => lerRepasses(p.payload));
  const vindos = todos.filter((r) => r.dataRepasse.startsWith(mes));

  const linhas = (await lerTudo(
    (de, ate) => db.from("repasses").select(SELECT_REPASSES).eq("empresa", job.empresa).eq("mes", mes).order("id").range(de, ate),
    `ler repasses de ${mes}`,
  )) as unknown as Record<string, unknown>[];
  const atuais: RepasseAtual[] = linhas.map((l) => ({ registro: doBanco(l), vistoNaUltimaSync: Boolean(l.visto_na_ultima_sync) }));
  const vinculosAtuais = new Map(
    linhas.map((l) => [
      chaveDoRepasse(doBanco(l)),
      { unidade_id: l.unidade_id as number | null, profissional_id: l.profissional_id as number | null, convenio_id: l.convenio_id as number | null },
    ]),
  );

  const dif = diferencaDoMesDeRepasse(atuais, vindos);

  const vinculador = criarVinculador(await lerOrigens(db, job.empresa), mes);
  const vinculos = new Map<string, Vinculos>();
  const vincular = (r: RegistroDeRepasse) => {
    const chave = chaveDoRepasse(r);
    if (!vinculos.has(chave)) vinculos.set(chave, vinculador.vincular(r));
    return vinculos.get(chave)!;
  };

  const gravar = planejarGravacao({ vindos, diferenca: dif, vinculosAtuais, vincular, chave: chaveDoRepasse }).map(({ registro, vinculos }) => ({
    ...paraBanco(registro),
    ...vinculos,
  }));

  // O job traz o mês inteiro: os títulos saem do que veio, não do que mudou.
  const titulos = montarTitulos(
    semRepasseRepetido(vindos).map((r) => ({ ...r, profissionalId: vincular(r).profissional_id })),
  ).map((t) => ({
    numero_repasse: t.numeroRepasse,
    nome_profissional_origem: t.nomeProfissional,
    profissional_id: t.profissionalId,
    data_repasse: t.dataRepasse,
    linhas: t.linhas,
    total_exato: t.totalExato,
    total_centavos: t.totalCentavos.toString(),
  }));

  const { error } = await db.rpc("aplicar_mes_de_repasses", {
    p_empresa: job.empresa,
    p_mes: mes,
    p_diferenca: {
      gravar,
      sumiram: dif.sumiram,
      voltaram: dif.voltaram,
      titulos,
      pendencias: vinculador.pendencias(),
      resolver: vinculador.resolver(),
    },
  });
  if (error) throw new Error(`aplicar repasses de ${mes}: ${error.message}`);

  return {
    mes,
    linhas: vindos.length,
    foraDoMes: todos.length - vindos.length,
    novos: dif.novos.length,
    alterados: dif.alterados.length,
    religados: gravar.length - dif.novos.length - dif.alterados.length,
    sumiram: dif.sumiram.length,
    voltaram: dif.voltaram.length,
    titulos: titulos.length,
    pendencias: vinculador.pendencias().length,
  };
}
