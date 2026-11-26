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

/** A rota é a do item ou está abaixo dela (`/conferencias` não está abaixo de `/conferencia`). */
export function estaAtivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Trilha do breadcrumb: a seção (sem link) e a tela. */
export function trilhaDe(pathname: string): PassoDaTrilha[] {
  for (const secao of MENU) {
    const item = secao.itens.find((i) => estaAtivo(pathname, i.href));
    if (item) return [{ rotulo: secao.titulo }, { rotulo: item.rotulo, href: item.href }];
  }
  return [];
}
