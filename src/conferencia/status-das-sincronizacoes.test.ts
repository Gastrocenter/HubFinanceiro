import { describe, expect, it } from "vitest";
import { statusDasSincronizacoes, type JobDaFila } from "./status-das-sincronizacoes";

const agora = new Date("2026-11-26T12:00:00Z");
const job = (rota: string, estado: JobDaFila["estado"], atualizadoEm: string, ultimoErro: string | null = null, empresa = "E1"): JobDaFila => ({
  empresa,
  rota,
  estado,
  concluidoEm: estado === "concluido" ? atualizadoEm : null,
  atualizadoEm,
  ultimoErro,
});

describe("statusDasSincronizacoes", () => {
  it("por rota: última conclusão, falhas depois dela com o último erro, e parado se não conclui há mais de 24 h (+2 h de folga)", () => {
    const status = statusDasSincronizacoes(
      [
        job("/api/v1/Exportacoes/Repasses", "concluido", "2026-11-26T08:00:00Z"),
        job("/api/v1/Exportacoes/Repasses", "falhou", "2026-11-20T08:00:00Z", "antiga, antes da última conclusão"),
        job("/api/v1/Exportacoes/ProcedimentosContasPacientes", "concluido", "2026-11-25T09:59:00Z"),
        job("/api/v1/Exportacoes/ProcedimentosContasPacientes", "falhou", "2026-11-25T10:00:00Z", "401"),
        job("/api/v1/Exportacoes/ProcedimentosContasPacientes", "falhou", "2026-11-26T09:00:00Z", "500"),
      ],
      agora,
    );
    expect(status).toEqual([
      {
        empresa: "E1",
        rota: "/api/v1/Exportacoes/ProcedimentosContasPacientes",
        nome: "Procedimentos",
        ultimaConclusao: "2026-11-25T09:59:00Z",
        falhas: 2,
        ultimoErro: "500",
        parado: true,
      },
      { empresa: "E1", rota: "/api/v1/Exportacoes/Repasses", nome: "Repasses", ultimaConclusao: "2026-11-26T08:00:00Z", falhas: 0, ultimoErro: null, parado: false },
    ]);
  });

  it("rota que nunca concluiu está parada; job pendente ou executando não conta como falha", () => {
    const [status] = statusDasSincronizacoes(
      [job("/api/v1/Convenios", "pendente", "2026-11-26T11:00:00Z"), job("/api/v1/Convenios", "executando", "2026-11-26T11:30:00Z")],
      agora,
    );
    expect(status).toMatchObject({ nome: "Convênios", ultimaConclusao: null, falhas: 0, parado: true });
  });

  it("rota esperada sem nenhum job no período aparece parada", () => {
    const status = statusDasSincronizacoes([job("/api/v1/Exportacoes/Repasses", "concluido", "2026-11-26T08:00:00Z")], agora, {
      empresas: ["E1"],
      rotas: ["/api/v1/Exportacoes/Repasses", "/api/v1/Usuarios"],
    });
    expect(status.map((s) => [s.nome, s.parado])).toEqual([["Profissionais", true], ["Repasses", false]]);
  });

  it("a folga cobre o atraso do agendamento diário: 26 h ainda não é parado; rota desconhecida aparece pelo caminho", () => {
    const [status] = statusDasSincronizacoes([job("/api/v1/Outra", "concluido", "2026-11-25T10:00:00Z")], agora);
    expect(status).toMatchObject({ nome: "/api/v1/Outra", parado: false });
  });

  it("cada empresa tem o seu status: a que concluiu não esconde a que parou", () => {
    const status = statusDasSincronizacoes(
      [
        job("/api/v1/Exportacoes/Repasses", "concluido", "2026-11-26T08:00:00Z", null, "E1"),
        job("/api/v1/Exportacoes/Repasses", "concluido", "2026-11-20T08:00:00Z", null, "E2"),
      ],
      agora,
    );
    expect(status.map((s) => [s.empresa, s.parado])).toEqual([["E1", false], ["E2", true]]);
  });
});
