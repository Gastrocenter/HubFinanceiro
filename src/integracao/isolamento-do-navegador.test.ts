import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const TABELAS = ["perfis_usuarios", "auditoria", "sync_jobs", "prodoctor_payload_bruto", "unidades", "profissionais", "convenios", "de_para"] as const;
/** Corpos com colunas reais: assim a recusa só pode ser de permissão, não de pedido malformado. */
const CORPO_VALIDO: Record<(typeof TABELAS)[number], Record<string, unknown>> = {
  perfis_usuarios: { usuario_id: "00000000-0000-0000-0000-000000000000", perfil: "admin" },
  auditoria: { acao: "invasao" },
  sync_jobs: { empresa: "X", rota: "/x", caminho_da_lista: "x" },
  prodoctor_payload_bruto: { job_id: 1, empresa: "X", rota: "/x", corpo_pedido: {}, pagina: 1, payload: {} },
  unidades: { nome: "x" },
  profissionais: { nome: "x" },
  convenios: { nome: "x" },
  de_para: { empresa: "X", tipo: "unidade", codigo_origem: "1", nome_origem: "x", unidade_id: 1 },
};

/** Funções com argumentos reais, pelo mesmo motivo. */
const FUNCOES: Record<string, Record<string, unknown>> = {
  reivindicar_proximo_job: { p_posse_segundos: 60 },
  registrar_erro_job: { p_id: 1, p_mensagem: "x", p_definitivo: true },
  liberar_job: { p_id: 1 },
  aplicar_plano_de_cadastro: { p_empresa: "X", p_tipo: "unidade", p_plano: {} },
  revisar_cadastro: { p_de_para_id: 1, p_usuario: "00000000-0000-0000-0000-000000000000", p_eh_medico: true },
};

function chamar(tabela: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${tabela}`, {
    ...init,
    headers: {
      apikey: chavePublica!,
      Authorization: `Bearer ${chavePublica}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe.skipIf(!url || !chavePublica)("isolamento do navegador (chave pública)", () => {
  for (const tabela of TABELAS) {
    it(`não lê nada de ${tabela}`, async () => {
      const resposta = await chamar(`${tabela}?select=*`);
      const corpo = await resposta.json();
      // 42501 = permission denied. Um 404 (tabela inexistente) não vale como prova.
      expect(resposta.status).toBe(401);
      expect(corpo.code).toBe("42501");
    });

    it(`não grava em ${tabela}`, async () => {
      const corpo = CORPO_VALIDO[tabela];
      const resposta = await chamar(tabela, { method: "POST", body: JSON.stringify(corpo) });
      expect(resposta.status).toBe(401);
      expect((await resposta.json()).code).toBe("42501");
    });
  }

  for (const [funcao, argumentos] of Object.entries(FUNCOES)) {
    it(`não executa a função ${funcao}`, async () => {
      const resposta = await chamar(`rpc/${funcao}`, { method: "POST", body: JSON.stringify(argumentos) });
      expect(resposta.status).toBe(401);
      expect((await resposta.json()).code).toBe("42501");
    });
  }
});
