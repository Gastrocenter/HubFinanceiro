import { describe, expect, it } from "vitest";
import { criarClienteProDoctor } from "./cliente";
import type { Relogio } from "./limitador";
import { ErroDeRedeProDoctor, ehFalhaPassageira } from "./retentativa";

const relogioInstantaneo: Relogio = { agora: () => 0, esperar: async () => {} };

const ambiente = {
  PRODOCTOR_SABIN_APIKEY: "chave-sabin-teste",
  PRODOCTOR_SABIN_APIPASSWORD: "senha-sabin-teste",
  PRODOCTOR_STELLA_APIKEY: "chave-stella-teste",
  PRODOCTOR_STELLA_APIPASSWORD: "senha-stella-teste",
};

type Pedido = { url: string; init: RequestInit };

/** fetch falso: responde em sequência e anota cada pedido. */
function fetchFalso(respostas: { status: number; corpo: unknown }[]) {
  const pedidos: Pedido[] = [];
  let i = 0;
  const fn = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    const r = respostas[Math.min(i++, respostas.length - 1)];
    return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

const paginaComUmLocal = { status: 200, corpo: { payload: { locaisProDoctor: [{ codigo: 1 }] }, message: null } };
const paginaVazia = { status: 200, corpo: { payload: { locaisProDoctor: [] }, message: null } };

describe("criarClienteProDoctor", () => {
  it("manda POST com as credenciais da empresa escolhida, e só dela", async () => {
    const f = fetchFalso([paginaComUmLocal, paginaVazia]);
    const cliente = criarClienteProDoctor({ empresa: "stella", ambiente, fetch: f.fn, relogio: relogioInstantaneo });

    const locais = await cliente.coletar("/api/v1/LocaisProDoctor", { somenteAtivos: true }, "locaisProDoctor");

    expect(locais).toEqual([{ codigo: 1 }]);
    const { url, init } = f.pedidos[0];
    const cabecalhos = new Headers(init.headers);
    expect(url).toBe("https://open-api.prodoctor.net/api/v1/LocaisProDoctor");
    expect(init.method).toBe("POST");
    expect(cabecalhos.get("X-APIKEY")).toBe("chave-stella-teste");
    expect(cabecalhos.get("X-APIPASSWORD")).toBe("senha-stella-teste");
    expect(cabecalhos.get("X-APITIMEZONENAME")).toBe("America/Sao_Paulo");
    expect(JSON.parse(String(init.body))).toEqual({ somenteAtivos: true, pagina: 1 });
  });

  it("erro HTTP traz status e mensagem da API, mas nunca a chave ou a senha", async () => {
    const ecoaCredencial = { status: 401, corpo: { payload: null, message: "Chave chave-sabin-teste/senha-sabin-teste recusada" } };
    const f = fetchFalso([ecoaCredencial]);
    const cliente = criarClienteProDoctor({ empresa: "sabin", ambiente, fetch: f.fn, relogio: relogioInstantaneo });

    const erro = await cliente.coletar("/api/v1/Usuarios", {}, "usuarios").catch((e: Error) => e);

    expect(erro).toBeInstanceOf(Error);
    const mensagem = (erro as Error).message;
    expect(mensagem).toMatch(/401/);
    expect(mensagem).toMatch(/recusada/);
    expect(mensagem).not.toContain("chave-sabin-teste");
    expect(mensagem).not.toContain("senha-sabin-teste");
    expect(f.pedidos).toHaveLength(1); // 401 não é tentado de novo
  });

  it("tenta de novo quando o ProDoctor responde 503", async () => {
    const f = fetchFalso([{ status: 503, corpo: {} }, paginaComUmLocal, paginaVazia]);
    const cliente = criarClienteProDoctor({ empresa: "sabin", ambiente, fetch: f.fn, relogio: relogioInstantaneo });
    await expect(cliente.coletar("/api/v1/LocaisProDoctor", {}, "locaisProDoctor")).resolves.toEqual([{ codigo: 1 }]);
    expect(f.pedidos).toHaveLength(3);
  });

  it("falha de rede (fetch rejeita) é passageira: tenta de novo e, se persistir, sai como ErroDeRedeProDoctor sem credencial", async () => {
    let chamadas = 0;
    const respostas = fetchFalso([paginaComUmLocal, paginaVazia]);
    const instavel = (async (url: string, init: RequestInit) => {
      if (chamadas++ === 0) throw new TypeError("fetch failed");
      return respostas.fn(url, init);
    }) as unknown as typeof fetch;
    const cliente = criarClienteProDoctor({ empresa: "sabin", ambiente, fetch: instavel, relogio: relogioInstantaneo });
    await expect(cliente.coletar("/api/v1/LocaisProDoctor", {}, "locaisProDoctor")).resolves.toEqual([{ codigo: 1 }]);
    expect(chamadas).toBe(3);

    const foraDoAr = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const semRede = criarClienteProDoctor({ empresa: "sabin", ambiente, fetch: foraDoAr, relogio: relogioInstantaneo });
    const erro = await semRede.coletar("/api/v1/LocaisProDoctor", {}, "locaisProDoctor").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeRedeProDoctor);
    expect(ehFalhaPassageira(erro)).toBe(true);
    expect(String((erro as Error).message)).not.toContain("chave-sabin-teste");
  });

  it("conexão que cai no meio do corpo (TypeError ao ler) também é passageira; JSON malformado não", async () => {
    let chamadas = 0;
    const respostas = fetchFalso([paginaComUmLocal, paginaVazia]);
    const cortaNoMeio = (async (url: string, init: RequestInit) => {
      if (chamadas++ > 0) return respostas.fn(url, init);
      const corpo = new ReadableStream({ start: (c) => c.error(new TypeError("terminated")) });
      return new Response(corpo, { status: 200 });
    }) as unknown as typeof fetch;
    const cliente = criarClienteProDoctor({ empresa: "sabin", ambiente, fetch: cortaNoMeio, relogio: relogioInstantaneo });
    await expect(cliente.coletar("/api/v1/LocaisProDoctor", {}, "locaisProDoctor")).resolves.toEqual([{ codigo: 1 }]);
    expect(chamadas).toBe(3);

    let malformadas = 0;
    const malformado = (async () => {
      malformadas++;
      return new Response("{não é json", { status: 200 });
    }) as unknown as typeof fetch;
    const comDefeito = criarClienteProDoctor({ empresa: "sabin", ambiente, fetch: malformado, relogio: relogioInstantaneo });
    const erro = await comDefeito.coletar("/api/v1/LocaisProDoctor", {}, "locaisProDoctor").catch((e: unknown) => e);
    expect(ehFalhaPassageira(erro)).toBe(false);
    expect(malformadas).toBe(1);
  });

  it("empresa sem credencial falha antes de chamar a API, citando a variável que falta", () => {
    const f = fetchFalso([paginaVazia]);
    expect(() => criarClienteProDoctor({ empresa: "nova", ambiente, fetch: f.fn })).toThrow(/PRODOCTOR_NOVA_APIKEY/);
    expect(() =>
      criarClienteProDoctor({ empresa: "sabin", ambiente: { PRODOCTOR_SABIN_APIKEY: "x" }, fetch: f.fn }),
    ).toThrow(/PRODOCTOR_SABIN_APIPASSWORD/);
    expect(f.pedidos).toHaveLength(0);
  });
});
