import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const TABELAS = ["perfis_usuarios", "auditoria", "sync_jobs", "prodoctor_payload_bruto", "unidades", "profissionais", "convenios", "de_para", "recebiveis", "pendencias", "repasses", "titulos_repasse", "plano_financeiro", "contas_pagar_receber"] as const;
const filtrosDeTeste = {
  p_natureza: "pagar", p_aba: "todas", p_de: "2026-10-01", p_ate: "2026-10-31", p_tipo_data: "vencimento",
  p_situacoes: [], p_categorias: [], p_fornecedor: null,
};
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
  recebiveis: { empresa: "X", codigo_local: "1", conta: "1", linha: "1", mes: "2026-10", data: "2026-10-01" },
  pendencias: { tipo: "x", empresa: "X", referencia: "x", descricao: "x" },
  repasses: { empresa: "X", codigo_local: "1", conta: "1", linha: "1", mes: "2026-10", numero_repasse: "1", data_repasse: "2026-10-01", data: "2026-09-01" },
  titulos_repasse: { empresa: "X", mes: "2026-10", numero_repasse: "1", nome_profissional_origem: "x", data_repasse: "2026-10-01", linhas: 1, total_exato: "1", total_centavos: 100 },
  plano_financeiro: { empresa: "X", tipo: "conta_contabil", codigo: "1", nome: "x" },
  contas_pagar_receber: { empresa: "X", codigo_local: "1", numero: "1", mes: "2026-10", data_inclusao: "2026-10-01" },
};

/** Funções com argumentos reais, pelo mesmo motivo. */
const FUNCOES: Record<string, Record<string, unknown>> = {
  reivindicar_proximo_job: { p_posse_segundos: 60 },
  registrar_erro_job: { p_id: 1, p_mensagem: "x", p_definitivo: true },
  liberar_job: { p_id: 1 },
  aplicar_plano_de_cadastro: { p_empresa: "X", p_tipo: "unidade", p_plano: {} },
  aplicar_mes_de_procedimentos: { p_empresa: "X", p_mes: "2026-10", p_diferenca: {} },
  conferir_receita_do_job: { p_job_id: 1 },
  resumo_receita: { p_mes: "2026-10" },
  meses_com_receita: {},
  aplicar_mes_de_repasses: { p_empresa: "X", p_mes: "2026-10", p_diferenca: {} },
  conferir_repasse_do_job: { p_job_id: 1 },
  resumo_repasses: { p_mes: "2026-10" },
  a_repassar: {},
  meses_com_repasse: {},
  integridade_das_exportacoes: {},
  resolver_pendencia: { p_id: 1, p_usuario: "00000000-0000-0000-0000-000000000000", p_justificativa: "x" },
  aplicar_plano_financeiro: { p_empresa: "X", p_tipo: "conta_contabil", p_itens: [] },
  aplicar_mes_de_contas: { p_empresa: "X", p_mes: "2026-10", p_diferenca: {} },
  conferir_contas_do_job: { p_job_id: 1 },
  resumo_contas: { p_mes: "2026-10" },
  contas_a_pagar_do_mes: { p_mes: "2026-10" },
  meses_com_contas: {},
  totais_contas: { p_mes: "2026-10" },
  natureza_da_conta: { p_situacao: "PAGAR" },
  sinais_dos_profissionais: {},
  expurgar_payload_de_exportacao: { p_dias: 120 },
  revisar_cadastro: { p_de_para_id: 1, p_usuario: "00000000-0000-0000-0000-000000000000", p_eh_medico: true },
  itens_para_categorizar: {},
  definir_categoria_do_item: { p_natureza: "pagar", p_item: "x", p_categoria_id: 1, p_usuario: "00000000-0000-0000-0000-000000000000" },
  salvar_categoria: { p_natureza: "pagar", p_id: null, p_nome: "x", p_usuario: "00000000-0000-0000-0000-000000000000" },
  slug_da_categoria: { p_nome: "x" },
  contas_filtradas: filtrosDeTeste,
  listar_contas: filtrosDeTeste,
  totais_contas_filtradas: filtrosDeTeste,
  resumo_por_categoria: filtrosDeTeste,
  conferir_itens_sem_categoria: {},
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
