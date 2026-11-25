import { handleSchedule } from "@vercel/schedules";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { empresasConfiguradas } from "@/sync/empresas";
import { enfileirarCadastros } from "@/sync/fila";

// Agendamento privado (schedule/v1beta): sem URL pública, só o agendador da Vercel chama.
export const maxDuration = 60;

/** Dia da execução no horário de São Paulo: a mesma ocorrência entregue duas vezes gera a mesma chave. */
function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

export const POST = handleSchedule(async (meta) => {
  const empresas = empresasConfiguradas(process.env);
  const criados = await enfileirarCadastros(criarClienteAdmin(), empresas, diaEmSaoPaulo(meta.scheduledAt));
  console.log(JSON.stringify({ agendamento: meta.name, execucao: meta.executionId, empresas, jobsCriados: criados }));
});
