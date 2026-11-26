import { handleSchedule } from "@vercel/schedules";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { mesesAteHoje } from "@/receita/planejar-exportacoes";
import { empresasConfiguradas } from "@/sync/empresas";
import { enfileirarCadastros, enfileirarProcedimentos } from "@/sync/fila";

// Agendamento privado (schedule/v1beta): sem URL pública, só o agendador da Vercel chama.
// O nome "enfileirar-cadastros" ficou por histórico (renomear apaga o histórico do agendamento):
// hoje ele enfileira cadastros + janela de procedimentos e roda o expurgo LGPD (ADR-0005).
export const maxDuration = 60;

/** Meses da janela diária de procedimentos (D-P): o atual e os 2 anteriores (~90 dias, L2). */
const MESES_NA_JANELA = 3;

/** Dia da execução no horário de São Paulo: a mesma ocorrência entregue duas vezes gera a mesma chave. */
function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

export const POST = handleSchedule(async (meta) => {
  const db = criarClienteAdmin();
  const dia = diaEmSaoPaulo(meta.scheduledAt);
  const empresas = empresasConfiguradas(process.env);

  // Cadastros primeiro: a fila processa em ordem de criação, e a receita usa o de-para.
  const cadastros = await enfileirarCadastros(db, empresas, dia);
  let procedimentos = 0;
  for (const empresa of empresas) {
    procedimentos += await enfileirarProcedimentos(db, empresa, mesesAteHoje(dia, MESES_NA_JANELA), dia);
  }

  const { data: expurgadas, error } = await db.rpc("expurgar_payload_de_exportacao", { p_dias: 120 });
  if (error) throw new Error(`expurgo LGPD: ${error.message}`);

  console.log(JSON.stringify({ agendamento: meta.name, execucao: meta.executionId, dia, empresas, cadastros, procedimentos, expurgadas }));
});
