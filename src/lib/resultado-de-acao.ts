/**
 * O que uma server action de formulário devolve para a tela. Erro de regra volta como valor, não como exceção:
 * em produção o Next esconde a mensagem de uma exceção, e a pessoa precisa ler o motivo (ex.: "Escreva a
 * justificativa"). Falta de sessão ou de permissão continua redirecionando (exigirAcesso).
 */
export type ResultadoDeAcao = { ok: true; mensagem: string } | { ok: false; erro: string };

export const sucesso = (mensagem: string): ResultadoDeAcao => ({ ok: true, mensagem });
export const falha = (erro: string): ResultadoDeAcao => ({ ok: false, erro });
