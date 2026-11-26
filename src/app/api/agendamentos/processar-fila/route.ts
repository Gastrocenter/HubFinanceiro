import { handleSchedule } from "@vercel/schedules";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { processarFila } from "@/sync/fila";

// Agendamento privado (schedule/v1beta): sem URL pública, só o agendador da Vercel chama.
export const maxDuration = 300;

/**
 * Tempo para começar trabalho novo. A função vai até 300 s; os 120 s de folga cobrem a página em andamento
 * e uma normalização de mês que comece perto do fim (a de um mês de procedimentos leva dezenas de segundos).
 */
const ORCAMENTO_MS = 180_000;

export const POST = handleSchedule(async (meta) => {
  const resumo = await processarFila({ db: criarClienteAdmin(), prazoFinal: Date.now() + ORCAMENTO_MS });
  const porResultado = Object.groupBy(resumo.processados, (p) => p.resultado);
  console.log(
    JSON.stringify({
      agendamento: meta.name,
      execucao: meta.executionId,
      concluidos: porResultado.concluido?.length ?? 0,
      pausados: porResultado.pausado?.length ?? 0,
      falhas: porResultado.falhou?.length ?? 0,
    }),
  );
});
