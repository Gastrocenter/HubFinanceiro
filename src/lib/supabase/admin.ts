import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secret: ignora RLS. Só o servidor usa (ADR-0002).
 * Nunca importe este arquivo de um componente de cliente.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY não está definida neste ambiente.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
