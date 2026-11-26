/** Abertas sem login, mas o proxy ainda renova o token de quem tem sessão. */
const ROTAS_PUBLICAS = ["/login"];

/**
 * Nem passam pela sessão: as ilustrações (arquivos estáticos) e os agendamentos (o agendador não tem sessão de
 * usuário; a rota confere o próprio segredo).
 */
const ROTAS_FORA_DA_SESSAO = ["/illustrations", "/api/agendamentos"];

/** A rota é ela mesma ou está abaixo dela. `/login-suporte` não está abaixo de `/login` (code-review item 10). */
const dentroDe = (pathname: string) => (rota: string) => pathname === rota || pathname.startsWith(`${rota}/`);

/** O proxy não exige sessão nesta rota. */
export function ehRotaSemSessao(pathname: string): boolean {
  return [...ROTAS_PUBLICAS, ...ROTAS_FORA_DA_SESSAO].some(dentroDe(pathname));
}

/** O proxy nem toca a sessão nesta rota (sai antes de falar com o Supabase). */
export function ficaForaDaSessao(pathname: string): boolean {
  return ROTAS_FORA_DA_SESSAO.some(dentroDe(pathname));
}
