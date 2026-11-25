import type { Relogio } from "@/conectores/prodoctor/limitador";
import type { Transporte } from "@/conectores/prodoctor/paginacao";
import { extrairRegistros } from "@/conectores/prodoctor/resposta";
import { ehFalhaPassageira } from "@/conectores/prodoctor/retentativa";

export type Job = {
  id: string;
  empresa: string;
  rota: string;
  corpo: Record<string, unknown>;
  caminhoDaLista: string;
  proximaPagina: number;
};

/** Onde o progresso do job é gravado. Em produção é o Postgres; nos testes, memória. */
export type RepositorioDeJobs = {
  /** Guarda a resposta bruta da página. Idempotente por (job, página). */
  salvarPagina: (job: Job, pagina: number, bruto: unknown) => Promise<void>;
  avancar: (jobId: string, proximaPagina: number) => Promise<void>;
  concluir: (jobId: string) => Promise<void>;
  registrarErro: (jobId: string, mensagem: string, definitivo: boolean) => Promise<void>;
};

export type ResultadoDoJob = "concluido" | "pausado" | "falhou";

/** Teto de segurança por job, somando todas as rodadas: protege contra API que ignora a paginação. */
export const MAX_PAGINAS_POR_JOB = 1000;

export async function executarJob(
  job: Job,
  {
    transporte,
    repositorio,
    relogio,
    prazoFinal,
  }: { transporte: Transporte; repositorio: RepositorioDeJobs; relogio: Relogio; prazoFinal: number },
): Promise<ResultadoDoJob> {
  try {
    for (let pagina = job.proximaPagina; ; pagina++) {
      // Não começa página nova depois do prazo: a próxima rodada continua daqui.
      if (relogio.agora() >= prazoFinal) return "pausado";
      if (pagina > MAX_PAGINAS_POR_JOB) {
        throw new Error(`${job.rota}: passou de ${MAX_PAGINAS_POR_JOB} páginas sem terminar; a paginação pode estar sendo ignorada.`);
      }
      const bruto = await transporte(job.rota, { ...job.corpo, pagina });
      const registros = extrairRegistros(bruto, job.caminhoDaLista);
      if (registros.length === 0) {
        await repositorio.concluir(job.id);
        return "concluido";
      }
      // Salva antes de avançar: se a rodada morrer aqui, a página é refeita, nunca pulada.
      await repositorio.salvarPagina(job, pagina, bruto);
      await repositorio.avancar(job.id, pagina + 1);
    }
  } catch (erro) {
    // O transporte já esgotou as novas tentativas. Passageiro volta na próxima rodada; o resto falha.
    const definitivo = !ehFalhaPassageira(erro);
    await repositorio.registrarErro(job.id, erro instanceof Error ? erro.message : String(erro), definitivo);
    return definitivo ? "falhou" : "pausado";
  }
}
