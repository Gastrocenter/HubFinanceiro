import { handleSchedule } from "@vercel/schedules";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { mesesAteHoje } from "@/receita/planejar-exportacoes";
import { empresasConfiguradas } from "@/sync/empresas";
import { enfileirarCadastros, enfileirarContas, enfileirarProcedimentos, enfileirarRepasses } from "@/sync/fila";
import { executarRotinaDiaria } from "@/sync/rotina-diaria";

// Agendamento privado (schedule/v1beta): sem URL pública, só o agendador da Vercel chama.
// O nome "enfileirar-cadastros" ficou por histórico (renomear apaga o histórico do agendamento):
// hoje ele enfileira cadastros (com o plano financeiro), janela de procedimentos, de repasses e de contas a
// pagar/receber, e roda o expurgo LGPD (ADR-0005).
export const maxDuration = 60;

/** Meses da janela diária de procedimentos (D-P) e de repasses (D-X): o atual e os 2 anteriores (~90 dias, L2). */
const MESES_NA_JANELA = 3;
/** Contas a pagar/receber (issue 08b, D-3): 12 meses de inclusão, para a situação de uma conta paga depois ficar atual. */
const MESES_DE_CONTAS = 12;

/** Dia da execução no horário de São Paulo: a mesma ocorrência entregue duas vezes gera a mesma chave. */
function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

export const POST = handleSchedule(async (meta) => {
  const db = criarClienteAdmin();
  const dia = diaEmSaoPaulo(meta.scheduledAt);
  const empresas = empresasConfiguradas(process.env);

  const { enfileirado, expurgadas } = await executarRotinaDiaria({
    enfileirar: async () => {
      // Cadastros primeiro: a fila processa em ordem de criação, e a receita usa o de-para.
      const cadastros = await enfileirarCadastros(db, empresas, dia);
      let procedimentos = 0;
      let repasses = 0;
      let contas = 0;
      for (const empresa of empresas) {
        const janela = mesesAteHoje(dia, MESES_NA_JANELA);
        procedimentos += await enfileirarProcedimentos(db, empresa, janela, dia);
        // Depois dos procedimentos: o repasse se liga ao recebível do mesmo procedimento.
        repasses += await enfileirarRepasses(db, empresa, janela, dia);
        // O filtro vem do plano financeiro já gravado (cadastro de ontem); sem ele, espera o próximo dia.
        contas += await enfileirarContas(db, empresa, mesesAteHoje(dia, MESES_DE_CONTAS), dia);
      }
      return { cadastros, procedimentos, repasses, contas };
    },
    // Roda mesmo se enfileirar falhar (ADR-0005: nada de paciente além de 120 dias).
    expurgar: async () => {
      const { data, error } = await db.rpc("expurgar_payload_de_exportacao", { p_dias: 120 });
      if (error) throw new Error(`expurgo LGPD: ${error.message}`);
      return data as number;
    },
  });

  console.log(JSON.stringify({ agendamento: meta.name, execucao: meta.executionId, dia, empresas, ...enfileirado, expurgadas }));
});
