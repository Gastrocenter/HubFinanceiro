import { describe, expect, it } from "vitest";
import { sugerirMarcacao } from "./sugerir-marcacao";

describe("sugerirMarcacao", () => {
  it("especialidade médica sugere médico, citando a especialidade", () => {
    expect(sugerirMarcacao({ especialidades: ["Médico endoscopista"], procedimentos: 800 })).toEqual({
      sugestao: "medico",
      motivo: "Especialidade: Médico endoscopista",
    });
  });

  it("especialidade não médica sugere não médico; nenhum procedimento no período também", () => {
    expect(sugerirMarcacao({ especialidades: ["Nutricionista em geral"], procedimentos: 120 })).toEqual({
      sugestao: "nao_medico",
      motivo: "Especialidade não médica: Nutricionista em geral",
    });
    expect(sugerirMarcacao({ especialidades: [], procedimentos: 0 })).toEqual({
      sugestao: "nao_medico",
      motivo: "Nenhum procedimento nos últimos 12 meses",
    });
  });

  it("caso duvidoso não tem sugestão e diz por quê", () => {
    expect(sugerirMarcacao({ especialidades: ["Médico cardiologista", "Nutricionista em geral"], procedimentos: 10 })).toEqual({
      sugestao: null,
      motivo: "Especialidades médica e não médica misturadas: revisar",
    });
    expect(sugerirMarcacao({ especialidades: [], procedimentos: 17 })).toEqual({
      sugestao: null,
      motivo: "Faz procedimentos, mas sem especialidade registrada: revisar",
    });
  });
});
