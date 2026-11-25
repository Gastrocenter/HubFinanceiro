import { describe, expect, it } from "vitest";
import { executarJob, type Job, type RepositorioDeJobs } from "./executar-job";
import type { Relogio } from "@/conectores/prodoctor/limitador";
import type { Transporte } from "@/conectores/prodoctor/paginacao";
import { ErroHttpProDoctor } from "@/conectores/prodoctor/retentativa";

/** Repositório em memória que anota cada operação, em ordem. */
function repositorioEmMemoria() {
  const eventos: string[] = [];
  const paginas = new Map<number, unknown>();
  const repositorio: RepositorioDeJobs = {
    salvarPagina: async (_job, pagina, bruto) => {
      paginas.set(pagina, bruto);
      eventos.push(`salvar:${pagina}`);
    },
    avancar: async (_jobId, proximaPagina) => void eventos.push(`avancar:${proximaPagina}`),
    concluir: async () => void eventos.push("concluir"),
    registrarErro: async (_jobId, mensagem, definitivo) => void eventos.push(`erro:${definitivo ? "definitivo" : "passageiro"}:${mensagem}`),
  };
  return { repositorio, eventos, paginas };
}

/** Transporte falso com N páginas de 1 registro; cada chamada leva `custoMs` no relógio falso. */
function transportePaginado(totalPaginas: number, relogio: { avancar: (ms: number) => void }, custoMs = 1000) {
  const paginasPedidas: number[] = [];
  const transporte: Transporte = async (_rota, corpo) => {
    const pagina = corpo.pagina as number;
    paginasPedidas.push(pagina);
    relogio.avancar(custoMs);
    const registros = pagina <= totalPaginas ? [{ codigo: pagina }] : [];
    return { payload: { usuarios: registros }, message: null };
  };
  return { transporte, paginasPedidas };
}

function relogioFalso() {
  let agora = 0;
  const relogio: Relogio = { agora: () => agora, esperar: async (ms) => void (agora += ms) };
  return { relogio, avancar: (ms: number) => (agora += ms) };
}

const jobNovo: Job = {
  id: "job-1",
  empresa: "STELLA_CENTRAL",
  rota: "/api/v1/Usuarios",
  corpo: { somenteAtivos: true },
  caminhoDaLista: "usuarios",
  proximaPagina: 1,
};

describe("executarJob", () => {
  it("processa as páginas até a vazia, salvando cada uma, e conclui", async () => {
    const r = relogioFalso();
    const { transporte, paginasPedidas } = transportePaginado(2, r);
    const repo = repositorioEmMemoria();

    const resultado = await executarJob(jobNovo, { transporte, repositorio: repo.repositorio, relogio: r.relogio, prazoFinal: 60_000 });

    expect(resultado).toBe("concluido");
    expect(paginasPedidas).toEqual([1, 2, 3]);
    expect([...repo.paginas.keys()]).toEqual([1, 2]);
    expect(repo.eventos.at(-1)).toBe("concluir");
  });

  it("retoma da página onde parou e salva cada página antes de registrar o avanço", async () => {
    const r = relogioFalso();
    const { transporte, paginasPedidas } = transportePaginado(4, r);
    const repo = repositorioEmMemoria();

    await executarJob({ ...jobNovo, proximaPagina: 3 }, { transporte, repositorio: repo.repositorio, relogio: r.relogio, prazoFinal: 60_000 });

    expect(paginasPedidas).toEqual([3, 4, 5]);
    expect(repo.eventos).toEqual(["salvar:3", "avancar:4", "salvar:4", "avancar:5", "concluir"]);
  });

  it("pausa quando o prazo da rodada acaba, com o progresso salvo", async () => {
    const r = relogioFalso();
    const { transporte, paginasPedidas } = transportePaginado(100, r, 1000); // 1 s por página
    const repo = repositorioEmMemoria();

    const resultado = await executarJob(jobNovo, { transporte, repositorio: repo.repositorio, relogio: r.relogio, prazoFinal: 3_000 });

    expect(resultado).toBe("pausado");
    expect(paginasPedidas).toEqual([1, 2, 3]);
    expect(repo.eventos.at(-1)).toBe("avancar:4");
    expect(repo.eventos).not.toContain("concluir");
  });

  it("erro definitivo (401) falha o job; erro passageiro (503) só pausa para a próxima rodada", async () => {
    const r = relogioFalso();
    const casos = [
      { status: 401, resultado: "falhou", tipo: "definitivo" },
      { status: 503, resultado: "pausado", tipo: "passageiro" },
    ] as const;

    for (const caso of casos) {
      const repo = repositorioEmMemoria();
      const transporte: Transporte = async (rota) => {
        throw new ErroHttpProDoctor(caso.status, rota);
      };
      const resultado = await executarJob(jobNovo, { transporte, repositorio: repo.repositorio, relogio: r.relogio, prazoFinal: 60_000 });

      expect(resultado, String(caso.status)).toBe(caso.resultado);
      expect(repo.eventos).toEqual([`erro:${caso.tipo}:ProDoctor respondeu ${caso.status} em /api/v1/Usuarios`]);
    }
  });

  it("falha como definitivo se passar do teto de páginas (API ignorando a paginação entre rodadas)", async () => {
    const r = relogioFalso();
    const { transporte, paginasPedidas } = transportePaginado(Infinity, r, 0);
    const repo = repositorioEmMemoria();

    const resultado = await executarJob({ ...jobNovo, proximaPagina: 999 }, { transporte, repositorio: repo.repositorio, relogio: r.relogio, prazoFinal: 60_000 });

    expect(resultado).toBe("falhou");
    expect(paginasPedidas).toEqual([999, 1000]);
    expect(repo.eventos.at(-1)).toMatch(/^erro:definitivo:.*1000 páginas/);
  });
});
