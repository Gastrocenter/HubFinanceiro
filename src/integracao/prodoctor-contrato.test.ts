import { describe, expect, it } from "vitest";
import { criarClienteProDoctor } from "@/conectores/prodoctor/cliente";

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
});
