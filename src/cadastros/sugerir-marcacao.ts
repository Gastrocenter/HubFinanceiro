export type SinaisDoProfissional = { especialidades: readonly string[]; procedimentos: number };

/** As marcações possíveis de um profissional (D-J). Fonte única: o tipo e a leitura do formulário saem daqui. */
export const MARCACOES = ["medico", "nao_medico"] as const;
export type Marcacao = (typeof MARCACOES)[number];

export type Sugestao = { sugestao: Marcacao | null; motivo: string };

const ehMedica = (especialidade: string) => especialidade.startsWith("Médico");

/** Sugere a marcação de médico a partir dos sinais. Só sugere: quem decide é uma pessoa (D-J). */
export function sugerirMarcacao({ especialidades, procedimentos }: SinaisDoProfissional): Sugestao {
  if (especialidades.length > 0 && especialidades.every(ehMedica)) {
    return { sugestao: "medico", motivo: `Especialidade: ${especialidades.join(", ")}` };
  }
  if (especialidades.length > 0 && !especialidades.some(ehMedica)) {
    return { sugestao: "nao_medico", motivo: `Especialidade não médica: ${especialidades.join(", ")}` };
  }
  if (especialidades.length > 0) {
    return { sugestao: null, motivo: "Especialidades médica e não médica misturadas: revisar" };
  }
  if (procedimentos === 0) return { sugestao: "nao_medico", motivo: "Nenhum procedimento nos últimos 12 meses" };
  return { sugestao: null, motivo: "Faz procedimentos, mas sem especialidade registrada: revisar" };
}
