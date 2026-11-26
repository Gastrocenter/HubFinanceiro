import { describe, expect, it } from "vitest";
import { criarClienteProDoctor } from "@/conectores/prodoctor/cliente";
import { lerCadastros } from "@/cadastros/ler-cadastros";
import { JOBS_DE_CADASTRO } from "@/sync/fila";

/** Primeira empresa com credencial no ambiente (PRODOCTOR_<EMPRESA>_APIKEY). Sem credencial, o teste é pulado. */
const empresa = Object.keys(process.env)
  .map((k) => /^PRODOCTOR_(.+)_APIKEY$/.exec(k)?.[1])
  .find((e): e is string => Boolean(e));

describe.skipIf(!empresa)("contrato com a API real do ProDoctor (só leitura)", () => {
  it("LocaisProDoctor devolve ao menos uma unidade com código numérico", async () => {
    const cliente = criarClienteProDoctor({ empresa: empresa! });
    const locais = (await cliente.coletar("/api/v1/LocaisProDoctor", { quantidade: 5000, somenteAtivos: true }, "locaisProDoctor")) as {
      codigo?: unknown;
    }[];

    expect(locais.length).toBeGreaterThan(0);
    for (const local of locais) expect(typeof local.codigo).toBe("number");
  }, 60_000);

  // Code-review item 9. Só contagens e campos: nenhum nome sai no relatório.
  const pedidoDoHub = (rota: string) => JOBS_DE_CADASTRO.find((j) => j.rota === rota)!;
  /** Pede a rota como o job do Hub pede (o mesmo corpo), com `sobrescrever` aplicado por cima. */
  async function coletarComoOHub(rota: string, sobrescrever: Record<string, unknown> = {}) {
    const { corpo, caminhoDaLista } = pedidoDoHub(rota);
    const registros = await criarClienteProDoctor({ empresa: empresa! }).coletar(rota, { ...corpo, ...sobrescrever }, caminhoDaLista);
    return { corpo, caminhoDaLista, registros: registros as Record<string, unknown>[] };
  }

  it("o job de convênios traz os inativos, e o Hub os lê como inativos (não como sumidos)", async () => {
    const rota = "/api/v1/Convenios";
    const { caminhoDaLista, registros } = await coletarComoOHub(rota);
    const lidos = lerCadastros(rota, { payload: { [caminhoDaLista]: registros } });

    expect(lidos.filter((c) => c.ativo).length).toBeGreaterThan(0);
    expect(lidos.filter((c) => !c.ativo).length).toBeGreaterThan(0);
  }, 60_000);

  it("o job de unidades pede todas, ativas ou não, e cada uma traz estadoRegistro", async () => {
    const { corpo, registros } = await coletarComoOHub("/api/v1/LocaisProDoctor");
    expect(corpo.somenteAtivos).toBe(false);
    for (const l of registros) expect(typeof l.estadoRegistro).toBe("number");
  }, 60_000);

  it("Usuarios não diz se o profissional está inativo: por isso o job pede só os ativos", async () => {
    const { corpo, registros: todos } = await coletarComoOHub("/api/v1/Usuarios", { somenteAtivos: false });
    expect(corpo.somenteAtivos).toBe(true);
    // Se um dia o ProDoctor passar a mandar o estado, este teste falha e o job pode pedir todos (item 9).
    expect(todos.some((u) => "estadoRegistro" in u)).toBe(false);
  }, 60_000);
});
