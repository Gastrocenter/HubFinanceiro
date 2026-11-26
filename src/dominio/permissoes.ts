export type Perfil = "admin" | "financeiro" | "aprovador" | "restrito";

export type Acao =
  | "acessar_painel"
  | "lancar_despesa"
  | "aprovar_despesa"
  | "pagar_despesa"
  | "ver_folha_individual"
  | "gerenciar_usuarios"
  | "ver_auditoria"
  | "revisar_cadastros";

const PERMISSOES: Record<Perfil, readonly Acao[]> = {
  admin: ["acessar_painel", "gerenciar_usuarios", "ver_auditoria", "revisar_cadastros"],
  financeiro: ["acessar_painel", "lancar_despesa", "pagar_despesa", "revisar_cadastros"],
  aprovador: ["acessar_painel", "aprovar_despesa"],
  restrito: ["acessar_painel", "ver_folha_individual"],
};

/** Um usuário pode acumular perfis; a permissão é a união dos perfis dele. */
export function temPermissao(perfis: readonly Perfil[], acao: Acao): boolean {
  return perfis.some((perfil) => PERMISSOES[perfil].includes(acao));
}
