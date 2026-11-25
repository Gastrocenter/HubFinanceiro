import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, RepositorioDeJobs } from "./executar-job";

type LinhaDeJob = {
  id: number;
  empresa: string;
  rota: string;
  corpo: Record<string, unknown>;
  caminho_da_lista: string;
  proxima_pagina: number;
};

function falhar(contexto: string, erro: { message: string } | null) {
  if (erro) throw new Error(`${contexto}: ${erro.message}`);
}

/** Repositório real da fila. Recebe um cliente com a chave secret (só servidor, ADR-0002). */
export function criarRepositorioPostgres(db: SupabaseClient) {
  const repositorio: RepositorioDeJobs & {
    reivindicar: (posseSegundos: number) => Promise<Job | null>;
    liberar: (jobId: string) => Promise<void>;
  } = {
    async reivindicar(posseSegundos) {
      const { data, error } = await db.rpc("reivindicar_proximo_job", { p_posse_segundos: posseSegundos });
      falhar("reivindicar job", error);
      const linha = (data as LinhaDeJob[] | null)?.[0];
      return linha
        ? {
            id: String(linha.id),
            empresa: linha.empresa,
            rota: linha.rota,
            corpo: linha.corpo,
            caminhoDaLista: linha.caminho_da_lista,
            proximaPagina: linha.proxima_pagina,
          }
        : null;
    },

    async salvarPagina(job, pagina, bruto) {
      const { error } = await db.from("prodoctor_payload_bruto").upsert(
        {
          job_id: Number(job.id),
          empresa: job.empresa,
          rota: job.rota,
          corpo_pedido: { ...job.corpo, pagina },
          pagina,
          payload: bruto,
        },
        { onConflict: "job_id,pagina" },
      );
      falhar(`salvar página ${pagina} do job ${job.id}`, error);
    },

    async avancar(jobId, proximaPagina) {
      const { error } = await db
        .from("sync_jobs")
        .update({ proxima_pagina: proximaPagina, atualizado_em: new Date().toISOString() })
        .eq("id", Number(jobId));
      falhar(`avançar job ${jobId}`, error);
    },

    async concluir(jobId) {
      const agora = new Date().toISOString();
      const { error } = await db
        .from("sync_jobs")
        .update({ estado: "concluido", posse_ate: null, concluido_em: agora, ultimo_erro: null, atualizado_em: agora })
        .eq("id", Number(jobId));
      falhar(`concluir job ${jobId}`, error);
    },

    async registrarErro(jobId, mensagem, definitivo) {
      const { error } = await db.rpc("registrar_erro_job", { p_id: Number(jobId), p_mensagem: mensagem, p_definitivo: definitivo });
      falhar(`registrar erro do job ${jobId}`, error);
    },

    async liberar(jobId) {
      const { error } = await db.rpc("liberar_job", { p_id: Number(jobId) });
      falhar(`liberar job ${jobId}`, error);
    },
  };
  return repositorio;
}
