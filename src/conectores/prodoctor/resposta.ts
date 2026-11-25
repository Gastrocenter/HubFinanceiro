/**
 * Devolve a lista de registros em `payload.<caminho>` (ex.: "usuarios", "exportacao.registros").
 * Se a lista não estiver lá, é erro: uma resposta de erro nunca pode virar "zero registros".
 */
export function extrairRegistros(resposta: unknown, caminho: string): unknown[] {
  const corpo = resposta as { payload?: unknown; message?: unknown } | null;
  let atual: unknown = corpo?.payload;
  for (const parte of caminho.split(".")) {
    atual = atual !== null && typeof atual === "object" ? (atual as Record<string, unknown>)[parte] : undefined;
  }
  if (!Array.isArray(atual)) {
    const mensagem = typeof corpo?.message === "string" && corpo.message ? ` Mensagem da API: ${corpo.message}` : "";
    throw new Error(`Resposta do ProDoctor sem a lista "payload.${caminho}".${mensagem}`);
  }
  return atual;
}
