import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteProDoctor } from "@/conectores/prodoctor/cliente";
import { relogioReal, type Relogio } from "@/conectores/prodoctor/limitador";
import type { Transporte } from "@/conectores/prodoctor/paginacao";
import { ehJobDeCadastro, normalizarCadastrosDoJob } from "@/cadastros/normalizar";
import { executarJob, type ResultadoDoJob } from "./executar-job";
import { criarRepositorioPostgres } from "./repositorio-postgres";

/** Cadastros sincronizados todo dia (issue 04). Uma página só: quantidade 5000. */
export const CADASTROS = [
  { rota: "/api/v1/LocaisProDoctor", caminhoDaLista: "locaisProDoctor" },
  { rota: "/api/v1/Usuarios", caminhoDaLista: "usuarios" },
  { rota: "/api/v1/Convenios", caminhoDaLista: "convenios" },
] as const;

/** Cria os jobs de cadastro do dia. Idempotente: rodar duas vezes no mesmo dia não duplica. */
export async function enfileirarCadastros(db: SupabaseClient, empresas: string[], dia: string, sufixo = "") {
  const linhas = empresas.flatMap((empresa) =>
    CADASTROS.map((c) => ({
      empresa,
      rota: c.rota,
      caminho_da_lista: c.caminhoDaLista,
      corpo: { quantidade: 5000, somenteAtivos: true },
      chave_idempotencia: `cadastros:${empresa}:${c.rota}:${dia}${sufixo}`,
    })),
  );
  const { data, error } = await db
    .from("sync_jobs")
    .upsert(linhas, { onConflict: "chave_idempotencia", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`enfileirar cadastros: ${error.message}`);
  return data?.length ?? 0;
}

export type ResumoDaRodada = { processados: { jobId: string; empresa: string; rota: string; resultado: ResultadoDoJob }[] };

/**
 * Pega jobs da fila e executa até o prazo. Execuções podem se sobrepor: a posse no banco
 * garante que cada job esteja em uma rodada só.
 */
export async function processarFila({
  db,
  ambiente = process.env,
  relogio = relogioReal,
  prazoFinal,
  posseSegundos = 360,
}: {
  db: SupabaseClient;
  ambiente?: Record<string, string | undefined>;
  relogio?: Relogio;
  prazoFinal: number;
  posseSegundos?: number;
}): Promise<ResumoDaRodada> {
  const repositorio = criarRepositorioPostgres(db);
  const transportes = new Map<string, Transporte>();
  const processados: ResumoDaRodada["processados"] = [];

  while (relogio.agora() < prazoFinal) {
    const job = await repositorio.reivindicar(posseSegundos);
    if (!job) break;

    let transporte = transportes.get(job.empresa);
    if (!transporte) {
      try {
        transporte = criarClienteProDoctor({ empresa: job.empresa, ambiente, relogio }).transporte;
        transportes.set(job.empresa, transporte);
      } catch (erro) {
        // Credencial ausente: não adianta tentar de novo até alguém configurar.
        await repositorio.registrarErro(job.id, (erro as Error).message, true);
        processados.push({ jobId: job.id, empresa: job.empresa, rota: job.rota, resultado: "falhou" });
        continue;
      }
    }

    let resultado = await executarJob(job, { transporte, repositorio, relogio, prazoFinal });
    if (resultado === "pausado") await repositorio.liberar(job.id);

    // Cadastro concluído vira de-para na mesma rodada (D-M). Se falhar, o job fica com o erro visível (F7).
    if (resultado === "concluido" && ehJobDeCadastro(job.rota)) {
      try {
        await normalizarCadastrosDoJob(db, job);
      } catch (erro) {
        await repositorio.registrarErro(job.id, `normalização: ${(erro as Error).message}`, true);
        resultado = "falhou";
      }
    }
    processados.push({ jobId: job.id, empresa: job.empresa, rota: job.rota, resultado });
  }
  return { processados };
}
