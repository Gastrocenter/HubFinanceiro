import { extrairRegistros } from "@/conectores/prodoctor/resposta";

/** Grupos de receita/despesa e contas contábeis do ProDoctor (D-4): filtro obrigatório da exportação de contas. */
export type TipoDoPlano = "grupo_receita_despesa" | "conta_contabil";

export type ItemDoPlano = {
  tipo: TipoDoPlano;
  /** Texto: "1.01.02.003". Vai como `{ codigo }` no filtro da exportação. */
  codigo: string;
  nome: string;
  permiteLancamento: boolean;
  incluiBalancete: boolean;
  estadoRegistro: number | null;
};

export const ROTAS_DO_PLANO: Record<TipoDoPlano, { rota: string; caminhoDaLista: string }> = {
  grupo_receita_despesa: { rota: "/api/v1/Financeiro/GruposReceitasDespesas", caminhoDaLista: "gruposReceitasDespesas" },
  conta_contabil: { rota: "/api/v1/Financeiro/ContasContabeis", caminhoDaLista: "contasContabeis" },
};

export function lerPlanoFinanceiro(pagina: unknown, tipo: TipoDoPlano): ItemDoPlano[] {
  return extrairRegistros(pagina, ROTAS_DO_PLANO[tipo].caminhoDaLista).map((r) => {
    const b = r as Record<string, unknown>;
    if (typeof b.codigo !== "string" || b.codigo === "") throw new Error(`Item do plano financeiro (${tipo}) sem código.`);
    return {
      tipo,
      codigo: b.codigo,
      nome: typeof b.nome === "string" ? b.nome : "",
      permiteLancamento: b.permiteLancamento === true,
      incluiBalancete: b.incluiBalancete === true,
      estadoRegistro: typeof b.estadoRegistro === "number" ? b.estadoRegistro : null,
    };
  });
}
