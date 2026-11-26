import "server-only";
import { lerTudo } from "@/lib/ler-tudo";
import type { criarClienteAdmin } from "@/lib/supabase/admin";
import { empresasConfiguradas } from "@/sync/empresas";
import { ROTAS_DO_AGENDAMENTO, statusDasSincronizacoes, type JobDaFila, type StatusDaRota } from "./status-das-sincronizacoes";

/** Jobs lidos para o status das sincronizações: o bastante para ver uma parada longa. */
const DIAS_DE_FILA = 30;

type LinhaDaFila = {
  empresa: string;
  rota: string;
  estado: JobDaFila["estado"];
  concluido_em: string | null;
  atualizado_em: string;
  ultimo_erro: string | null;
};

/** Status de cada rota do agendamento, a partir da fila dos últimos 30 dias. Usado pela conferência e pelo painel. */
export async function lerSincronizacoes(db: ReturnType<typeof criarClienteAdmin>, agora: Date): Promise<StatusDaRota[]> {
  const desde = new Date(agora.getTime() - DIAS_DE_FILA * 24 * 60 * 60 * 1000).toISOString();
  const jobs = await lerTudo<LinhaDaFila>(
    (de, ate) =>
      db
        .from("sync_jobs")
        .select("empresa, rota, estado, concluido_em, atualizado_em, ultimo_erro")
        .gte("atualizado_em", desde)
        .order("id")
        .range(de, ate),
    "ler a fila",
  );
  return statusDasSincronizacoes(
    jobs.map((j) => ({
      empresa: j.empresa,
      rota: j.rota,
      estado: j.estado,
      concluidoEm: j.concluido_em,
      atualizadoEm: j.atualizado_em,
      ultimoErro: j.ultimo_erro,
    })),
    agora,
    { empresas: empresasConfiguradas(process.env), rotas: ROTAS_DO_AGENDAMENTO },
  );
}
