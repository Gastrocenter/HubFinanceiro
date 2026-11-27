import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Função ausente no banco: PostgREST não acha (PGRST202) ou o Postgres não conhece (42883). */
const FUNCAO_AUSENTE = new Set(["PGRST202", "42883"]);

/**
 * Depois de mudar a categoria de um item, abre a pendência "a revisar" do item que ficou sem categoria e resolve a
 * do que ganhou (D-5). A regra é do banco (`conferir_itens_sem_categoria`, S5), idempotente.
 *
 * A gravação da categoria já foi feita e auditada: uma falha aqui não a desfaz. Volta `false` para a tela avisar
 * que as pendências ficam para a próxima conferência.
 */
export async function conferirItensSemCategoria(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.rpc("conferir_itens_sem_categoria");
  if (!error) return true;
  if (FUNCAO_AUSENTE.has(error.code)) console.warn("conferir_itens_sem_categoria ainda não existe no banco.");
  else console.error(`conferir_itens_sem_categoria falhou: ${error.message}`);
  return false;
}
