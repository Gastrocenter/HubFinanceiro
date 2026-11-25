import { temPermissao, type Acao, type Perfil } from "./permissoes";

export type Sessao = { usuarioId: string; perfis: readonly Perfil[]; ativo: boolean };

export type DecisaoDeAcesso =
  | { tipo: "liberado" }
  | { tipo: "redirecionar"; para: "/login" }
  | { tipo: "negado" };

export function decidirAcesso(sessao: Sessao | null, acao: Acao): DecisaoDeAcesso {
  if (!sessao) return { tipo: "redirecionar", para: "/login" };
  if (!sessao.ativo || !temPermissao(sessao.perfis, acao)) return { tipo: "negado" };
  return { tipo: "liberado" };
}
