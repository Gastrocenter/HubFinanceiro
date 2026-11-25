import { criarLimitador, relogioReal, type Relogio } from "./limitador";
import { coletarTodasPaginas, type Transporte } from "./paginacao";
import { ErroHttpProDoctor, comRetentativas } from "./retentativa";

const URL_BASE = "https://open-api.prodoctor.net";

export type ClienteProDoctor = {
  /** Um pedido de uma página, já com limite de taxa e novas tentativas. */
  transporte: Transporte;
  /** Busca todas as páginas de uma rota e devolve a lista em `payload.<caminhoDaLista>`. */
  coletar: (rota: string, corpo: Record<string, unknown>, caminhoDaLista: string) => Promise<unknown[]>;
};

/**
 * Cliente de uma empresa (CNPJ). Credenciais em PRODOCTOR_<EMPRESA>_APIKEY e _APIPASSWORD.
 * Aplica o limite de 120 req/min (L4), novas tentativas em falha passageira e paginação.
 */
export function criarClienteProDoctor({
  empresa,
  ambiente = process.env,
  fetch: fazerFetch = globalThis.fetch,
  relogio = relogioReal,
}: {
  empresa: string;
  ambiente?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  relogio?: Relogio;
}): ClienteProDoctor {
  const prefixo = `PRODOCTOR_${empresa.toUpperCase()}`;
  const chave = ambiente[`${prefixo}_APIKEY`];
  const senha = ambiente[`${prefixo}_APIPASSWORD`];
  const faltando = [!chave && `${prefixo}_APIKEY`, !senha && `${prefixo}_APIPASSWORD`].filter(Boolean);
  if (!chave || !senha) {
    throw new Error(`Credencial do ProDoctor ausente para a empresa "${empresa}": defina ${faltando.join(" e ")}.`);
  }
  const aguardarVez = criarLimitador({ maxPorJanela: 120, janelaMs: 60_000, relogio });

  const transporte: Transporte = (rota, corpo) =>
    comRetentativas(
      async () => {
        await aguardarVez();
        const resposta = await fazerFetch(`${URL_BASE}${rota}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "HubFinanceiroGastrocenter/1.0",
            "X-APIKEY": chave,
            "X-APIPASSWORD": senha,
            "X-APITIMEZONE": "-03:00",
            "X-APITIMEZONENAME": "America/Sao_Paulo",
          },
          body: JSON.stringify(corpo),
        });
        if (!resposta.ok) {
          throw new ErroHttpProDoctor(resposta.status, rota, mascarar(await lerMensagem(resposta), [chave, senha]));
        }
        return resposta.json();
      },
      { relogio },
    );

  return { transporte, coletar: (rota, corpo, caminho) => coletarTodasPaginas(transporte, rota, corpo, caminho) };
}

/** Lê o campo `message` da resposta de erro, se houver. Nunca falha. */
async function lerMensagem(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = (await resposta.json()) as { message?: unknown };
    return typeof corpo?.message === "string" ? corpo.message : undefined;
  } catch {
    return undefined;
  }
}

/** Troca qualquer credencial que a API tenha ecoado por "***", para não vazar em log. */
function mascarar(texto: string | undefined, segredos: string[]): string | undefined {
  return segredos.reduce((t, segredo) => t?.replaceAll(segredo, "***"), texto);
}
