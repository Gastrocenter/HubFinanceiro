import { temPermissao, type Acao, type Perfil } from "./permissoes";

export type ItemDoMenu = { rotulo: string; href: string; acao: Acao };
export type SecaoDoMenu = { titulo: string; itens: ItemDoMenu[] };
export type PassoDaTrilha = { rotulo: string; href?: string };

/** As telas do Hub, na ordem do menu. Cada uma só aparece para quem tem a permissão que a própria página exige. */
const MENU: readonly SecaoDoMenu[] = [
  { titulo: "Geral", itens: [{ rotulo: "Painel", href: "/painel", acao: "acessar_painel" }] },
  {
    titulo: "Financeiro",
    itens: [
      { rotulo: "Receita", href: "/receita", acao: "ver_receita" },
      { rotulo: "Repasses", href: "/repasses", acao: "ver_repasse" },
      { rotulo: "Contas a pagar e receber", href: "/contas", acao: "ver_contas" },
    ],
  },
  {
    titulo: "Controle",
    itens: [
      { rotulo: "Conferência", href: "/conferencia", acao: "ver_conferencia" },
      { rotulo: "Cadastros e de-para", href: "/cadastros", acao: "revisar_cadastros" },
      // Editar categorias segue a permissão de cadastros: só admin e financeiro (issue 11, D-11).
      { rotulo: "Categorias", href: "/cadastros/categorias", acao: "revisar_cadastros" },
      { rotulo: "Auditoria", href: "/admin/auditoria", acao: "ver_auditoria" },
    ],
  },
];

/** O menu de quem tem estes perfis. Esconder o item é conforto; quem decide o acesso é `exigirAcesso` na página. */
export function menuPara(perfis: readonly Perfil[]): SecaoDoMenu[] {
  return MENU.map((s) => ({ ...s, itens: s.itens.filter((i) => temPermissao(perfis, i.acao)) })).filter(
    (s) => s.itens.length > 0,
  );
}

/** Um destino da busca rápida (⌘K): telas do menu e atalhos para filtros que já existem na URL. */
export type DestinoDaBusca = { rotulo: string; href: string; palavras: string[] };
export type GrupoDaBusca = { titulo: string; destinos: DestinoDaBusca[] };

/** Outras palavras para achar cada tela: o que a pessoa digita nem sempre é o nome do menu. */
const PALAVRAS: Record<string, string[]> = {
  "/painel": ["início", "resumo", "indicadores"],
  "/receita": ["faturamento", "procedimentos", "glosa", "competência", "bruto", "líquido"],
  "/repasses": ["profissional", "médico", "pagamento", "lote"],
  "/contas": ["pagar", "receber", "títulos", "vencimento"],
  "/conferencia": ["pendências", "sincronização", "integridade", "divergência", "prodoctor"],
  "/cadastros": ["profissionais", "convênios", "unidades", "de-para", "revisão"],
  "/cadastros/categorias": ["plano financeiro", "item", "sem categoria", "imposto", "despesa"],
  "/admin/auditoria": ["log", "histórico", "quem fez"],
};

/** Atalhos para filtros das telas; cada um exige a mesma permissão da tela de destino. */
const ATALHOS: readonly (DestinoDaBusca & { acao: Acao })[] = [
  { rotulo: "Pendências resolvidas", href: "/conferencia?estado=resolvida", acao: "ver_conferencia", palavras: ["histórico", "justificativa"] },
  { rotulo: "Profissionais a revisar", href: "/cadastros?tipo=profissional&filtro=a-revisar", acao: "revisar_cadastros", palavras: ["médico", "sugestão"] },
  { rotulo: "Convênios", href: "/cadastros?tipo=convenio&filtro=todos", acao: "revisar_cadastros", palavras: ["plano", "operadora"] },
  { rotulo: "Unidades", href: "/cadastros?tipo=unidade&filtro=todos", acao: "revisar_cadastros", palavras: ["local", "clínica"] },
];

/** O que a busca rápida oferece a quem tem estes perfis: as telas do menu, por seção, e os atalhos permitidos. */
export function buscaPara(perfis: readonly Perfil[]): GrupoDaBusca[] {
  const telas = menuPara(perfis).map((s) => ({
    titulo: s.titulo,
    destinos: s.itens.map((i) => ({ rotulo: i.rotulo, href: i.href, palavras: PALAVRAS[i.href] ?? [] })),
  }));
  const atalhos = ATALHOS.filter((a) => temPermissao(perfis, a.acao)).map(({ rotulo, href, palavras }) => ({ rotulo, href, palavras }));
  return atalhos.length > 0 ? [...telas, { titulo: "Atalhos", destinos: atalhos }] : telas;
}

/** A rota é a do item ou está abaixo dela (`/conferencias` não está abaixo de `/conferencia`). */
export function estaAtivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** O item ativo entre estes: o mais específico, para `/cadastros/categorias` não acender também `/cadastros`. */
export function itemAtivo(pathname: string, hrefs: readonly string[]): string | undefined {
  return hrefs.filter((h) => estaAtivo(pathname, h)).sort((a, b) => b.length - a.length)[0];
}

/** Trilha do breadcrumb: a seção (sem link) e a tela. */
export function trilhaDe(pathname: string): PassoDaTrilha[] {
  const ativo = itemAtivo(pathname, MENU.flatMap((s) => s.itens.map((i) => i.href)));
  for (const secao of MENU) {
    const item = secao.itens.find((i) => i.href === ativo);
    if (item) return [{ rotulo: secao.titulo }, { rotulo: item.rotulo, href: item.href }];
  }
  return [];
}
