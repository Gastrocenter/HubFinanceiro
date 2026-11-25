import { describe, expect, it } from "vitest";
import { coletarTodasPaginas, type Transporte } from "./paginacao";

/** Transporte falso: devolve as páginas dadas, depois página vazia, e anota cada pedido. */
function transporteComPaginas(paginas: unknown[][]) {
  const pedidos: { rota: string; corpo: Record<string, unknown> }[] = [];
  const transporte: Transporte = async (rota, corpo) => {
    pedidos.push({ rota, corpo });
    const n = corpo.pagina as number;
    return { payload: { exportacao: { registros: paginas[n - 1] ?? [] } }, message: null };
  };
  return { transporte, pedidos };
}

describe("coletarTodasPaginas", () => {
  it("junta as páginas em ordem até vir uma vazia, mantendo o resto do corpo", async () => {
    const { transporte, pedidos } = transporteComPaginas([[{ id: 1 }, { id: 2 }], [{ id: 3 }]]);
    const registros = await coletarTodasPaginas(transporte, "/api/v1/Exportacoes/Repasses", { dataInicial: "01/10/2026" }, "exportacao.registros");

    expect(registros).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(pedidos.map((p) => p.corpo.pagina)).toEqual([1, 2, 3]);
    expect(pedidos.every((p) => p.corpo.dataInicial === "01/10/2026" && p.rota === "/api/v1/Exportacoes/Repasses")).toBe(true);
  });

  it("para com erro se passar do teto de páginas (API ignorando a paginação)", async () => {
    let chamadas = 0;
    const semFim: Transporte = async () => {
      chamadas++;
      return { payload: { usuarios: [{ codigo: 1 }] } };
    };
    await expect(coletarTodasPaginas(semFim, "/api/v1/Usuarios", {}, "usuarios", { maxPaginas: 5 })).rejects.toThrow(/5 páginas/);
    expect(chamadas).toBe(5);
  });
});
