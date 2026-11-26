"use server";

import { refresh } from "next/cache";
import { exigirAcesso } from "@/lib/sessao";
import { falha, sucesso, type ResultadoDeAcao } from "@/lib/resultado-de-acao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Resolve uma pendência à mão, com justificativa (D-B). O banco fecha e audita na mesma transação, e recusa
 * de-para (D-C) e pendência que já não está aberta.
 */
export async function resolverPendencia(formulario: FormData): Promise<ResultadoDeAcao> {
  const sessao = await exigirAcesso("resolver_pendencia");
  const id = Number(formulario.get("id"));
  const justificativa = String(formulario.get("justificativa") ?? "").trim();
  if (!Number.isInteger(id)) return falha("Pendência inválida.");
  if (justificativa === "") return falha("Escreva a justificativa antes de resolver.");

  const { error } = await criarClienteAdmin().rpc("resolver_pendencia", {
    p_id: id,
    p_usuario: sessao.usuarioId,
    p_justificativa: justificativa,
  });
  if (error) return falha(`Não foi possível resolver: ${error.message}`);
  refresh();
  return sucesso("Pendência resolvida e registrada na auditoria.");
}
