"use server";

import { refresh } from "next/cache";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Resolve uma pendência à mão, com justificativa (D-B). O banco fecha e audita na mesma transação, e recusa
 * de-para (D-C) e pendência que já não está aberta.
 */
export async function resolverPendencia(formulario: FormData): Promise<void> {
  const sessao = await exigirAcesso("resolver_pendencia");
  const id = Number(formulario.get("id"));
  const justificativa = String(formulario.get("justificativa") ?? "").trim();
  if (!Number.isInteger(id)) throw new Error("Pendência inválida.");
  if (justificativa === "") throw new Error("Escreva a justificativa antes de resolver.");

  const { error } = await criarClienteAdmin().rpc("resolver_pendencia", {
    p_id: id,
    p_usuario: sessao.usuarioId,
    p_justificativa: justificativa,
  });
  if (error) throw new Error(`Não foi possível resolver: ${error.message}`);
  refresh();
}
