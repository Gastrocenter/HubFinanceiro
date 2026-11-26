import { describe, expect, it } from "vitest";
import { lerPlanoFinanceiro } from "./ler-plano-financeiro";

const item = (codigo: string, nome: string, extra: Record<string, unknown> = {}) => ({
  codigo, nome, incluiBalancete: true, permiteLancamento: true, estadoRegistro: 1, ...extra,
});

describe("lerPlanoFinanceiro", () => {
  it("lê grupos de receita/despesa e contas contábeis com código em texto", () => {
    const grupos = { payload: { gruposReceitasDespesas: [item("1.01.01", "Consultas"), item("2", "Despesas", { permiteLancamento: false, estadoRegistro: 0 })] } };
    expect(lerPlanoFinanceiro(grupos, "grupo_receita_despesa")).toEqual([
      { tipo: "grupo_receita_despesa", codigo: "1.01.01", nome: "Consultas", permiteLancamento: true, incluiBalancete: true, estadoRegistro: 1 },
      { tipo: "grupo_receita_despesa", codigo: "2", nome: "Despesas", permiteLancamento: false, incluiBalancete: true, estadoRegistro: 0 },
    ]);
    const contas = { payload: { contasContabeis: [item("1", "Receitas")] } };
    expect(lerPlanoFinanceiro(contas, "conta_contabil")).toEqual([
      { tipo: "conta_contabil", codigo: "1", nome: "Receitas", permiteLancamento: true, incluiBalancete: true, estadoRegistro: 1 },
    ]);
  });

  it("rejeita item sem código", () => {
    expect(() => lerPlanoFinanceiro({ payload: { contasContabeis: [item("", "Sem código")] } }, "conta_contabil")).toThrow(/código/);
  });
});
