import type { SupabaseClient } from "@supabase/supabase-js";
import { lerCadastros, type TipoDeCadastro } from "./ler-cadastros";
import { reconciliar, type CadastroAtual } from "./reconciliar";

export const ROTA_PARA_TIPO: Record<string, TipoDeCadastro> = {
  "/api/v1/LocaisProDoctor": "unidade",
  "/api/v1/Usuarios": "profissional",
  "/api/v1/Convenios": "convenio",
};

export function ehJobDeCadastro(rota: string): boolean {
  return rota in ROTA_PARA_TIPO;
}

/**
 * Lê as páginas brutas de um job de cadastro concluído, reconcilia com o de-para e aplica o plano (D-M).
 * Idempotente: rodar de novo sobre o mesmo job não muda nada.
 */
export async function normalizarCadastrosDoJob(db: SupabaseClient, job: { id: string; empresa: string; rota: string }) {
  const tipo = ROTA_PARA_TIPO[job.rota];
  if (!tipo) throw new Error(`${job.rota} não é um cadastro.`);

  const { data: paginas, error: erroPaginas } = await db
    .from("prodoctor_payload_bruto")
    .select("payload")
    .eq("job_id", Number(job.id))
    .order("pagina");
  if (erroPaginas) throw new Error(`ler páginas do job ${job.id}: ${erroPaginas.message}`);
  const vindos = (paginas ?? []).flatMap((p) => lerCadastros(job.rota, p.payload));

  const { data: linhas, error: erroAtuais } = await db
    .from("de_para")
    .select("codigo_origem, nome_origem, ativo, visto_na_ultima_sync")
    .eq("empresa", job.empresa)
    .eq("tipo", tipo);
  if (erroAtuais) throw new Error(`ler de-para: ${erroAtuais.message}`);
  const atuais: CadastroAtual[] = (linhas ?? []).map((l) => ({
    codigoOrigem: l.codigo_origem,
    nome: l.nome_origem,
    ativo: l.ativo,
    vistoNaUltimaSync: l.visto_na_ultima_sync,
  }));

  const plano = reconciliar(atuais, vindos);
  const { error } = await db.rpc("aplicar_plano_de_cadastro", { p_empresa: job.empresa, p_tipo: tipo, p_plano: plano });
  if (error) throw new Error(`aplicar plano de ${tipo}: ${error.message}`);

  return {
    tipo,
    criados: plano.criar.length,
    alterados: plano.atualizar.length,
    sumiram: plano.sumiram.length,
    voltaram: plano.voltaram.length,
  };
}
