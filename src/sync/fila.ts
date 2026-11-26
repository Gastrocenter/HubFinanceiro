import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteProDoctor } from "@/conectores/prodoctor/cliente";
import { relogioReal, type Relogio } from "@/conectores/prodoctor/limitador";
import type { Transporte } from "@/conectores/prodoctor/paginacao";
import { ehJobDeCadastro, normalizarCadastrosDoJob } from "@/cadastros/normalizar";
import { ROTA_PROCEDIMENTOS, normalizarProcedimentosDoJob } from "@/receita/normalizar";
import { periodoDoMes } from "@/receita/planejar-exportacoes";
import { ROTA_REPASSES, normalizarRepassesDoJob } from "@/repasse/normalizar";
import { lerTudo } from "@/lib/ler-tudo";
import { executarJob, type Job, type ResultadoDoJob } from "./executar-job";
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

/**
 * Cria um job de exportação por mês. Os filtros obrigatórios da API vêm dos códigos do de-para.
 * `rotulo` vai na chave: "AAAA-MM-DD" (janela diária) ou "carga-inicial" — rodar de novo não duplica.
 */
async function enfileirarExportacao(db: SupabaseClient, tipo: "procedimentos" | "repasses", rota: string, empresa: string, meses: string[], rotulo: string) {
  const origens = await lerTudo(
    (de, ate) => db.from("de_para").select("tipo, codigo_origem").eq("empresa", empresa).order("id").range(de, ate),
    `ler de-para de ${empresa}`,
  );
  const codigos = (t: string) => origens.filter((o) => o.tipo === t).map((o) => ({ codigo: Number(o.codigo_origem) }));
  const filtros = { locaisProDoctor: codigos("unidade"), convenios: codigos("convenio"), usuarios: codigos("profissional") };
  if (Object.values(filtros).some((lista) => lista.length === 0)) {
    // Sem cadastro normalizado ainda: a exportação seria recusada pela API. Tenta no próximo dia.
    return 0;
  }

  const linhas = meses.map((mes) => ({
    empresa,
    rota,
    caminho_da_lista: "exportacao.registros",
    corpo: { periodo: periodoDoMes(mes), ...filtros },
    chave_idempotencia: `${tipo}:${empresa}:${mes}:${rotulo}`,
  }));
  const { data, error } = await db.from("sync_jobs").upsert(linhas, { onConflict: "chave_idempotencia", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`enfileirar ${tipo}: ${error.message}`);
  return data?.length ?? 0;
}

/** Um job de procedimentos por mês do atendimento (issue 06). */
export const enfileirarProcedimentos = (db: SupabaseClient, empresa: string, meses: string[], rotulo: string) =>
  enfileirarExportacao(db, "procedimentos", ROTA_PROCEDIMENTOS, empresa, meses, rotulo);

/** Um job de repasses por mês de `dataRepasse` (D-X). Enfileirar depois dos procedimentos: o vínculo usa os recebíveis. */
export const enfileirarRepasses = (db: SupabaseClient, empresa: string, meses: string[], rotulo: string) =>
  enfileirarExportacao(db, "repasses", ROTA_REPASSES, empresa, meses, rotulo);

/** Normalização de cada rota de exportação, rodada no `aoConcluir` (D-M). */
const NORMALIZAR_EXPORTACAO: Record<string, (db: SupabaseClient, job: Job) => Promise<unknown>> = {
  [ROTA_PROCEDIMENTOS]: normalizarProcedimentosDoJob,
  [ROTA_REPASSES]: normalizarRepassesDoJob,
};

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

    // A normalização roda ANTES de concluir (D-M): job concluído sempre já virou de-para ou receita.
    const normalizar = NORMALIZAR_EXPORTACAO[job.rota] ?? (ehJobDeCadastro(job.rota) ? normalizarCadastrosDoJob : undefined);
    const aoConcluir = normalizar && (async () => void (await normalizar(db, job)));
    const resultado = await executarJob(job, { transporte, repositorio, relogio, prazoFinal, aoConcluir });
    if (resultado === "pausado") await repositorio.liberar(job.id);
    processados.push({ jobId: job.id, empresa: job.empresa, rota: job.rota, resultado });
  }
  return { processados };
}
