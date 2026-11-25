import "server-only";
import { criarClienteAdmin } from "./supabase/admin";

export type EventoDeAuditoria = {
  usuarioId?: string | null;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  detalhes?: Record<string, unknown>;
};

/** Grava no log append-only. Nunca receba senha ou token aqui. */
export async function registrarAuditoria(evento: EventoDeAuditoria): Promise<void> {
  const { error } = await criarClienteAdmin()
    .from("auditoria")
    .insert({
      usuario_id: evento.usuarioId ?? null,
      acao: evento.acao,
      entidade: evento.entidade ?? null,
      entidade_id: evento.entidadeId ?? null,
      detalhes: evento.detalhes ?? {},
    });
  if (error) throw new Error(`Falha ao gravar auditoria: ${error.message}`);
}
