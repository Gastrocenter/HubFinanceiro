import { handleSchedule } from "@vercel/schedules";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { processarFila } from "@/sync/fila";

// Agendamento privado (schedule/v1beta): sem URL pública, só o agendador da Vercel chama.
export const maxDuration = 300;

/** Margem antes do limite da função para terminar a página em andamento e liberar o job. */
const ORCAMENTO_MS = 240_000;

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
