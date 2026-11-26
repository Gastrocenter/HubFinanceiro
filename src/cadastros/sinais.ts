import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "@/lib/ler-tudo";
import { sugerirMarcacao, type Sugestao } from "./sugerir-marcacao";

export type SinaisComSugestao = { especialidades: string[]; procedimentos: number; meses: number } & Sugestao;

/** Sinais e sugestão por de-para de profissional, calculados no servidor. */
export async function carregarSugestoes(db: SupabaseClient): Promise<Map<number, SinaisComSugestao>> {
  // Página a página: o PostgREST corta em 1000 linhas. Ordem estável por de_para_id, pedida também ao PostgREST
  // (o limit/offset é aplicado por fora da função).
  const linhas = await lerTudo<{ de_para_id: number; especialidades: string[]; procedimentos: number; meses: number }>(
    (de, ate) => db.rpc("sinais_dos_profissionais").order("de_para_id").range(de, ate),
    "ler sinais dos profissionais",
  );
  return new Map(
    linhas.map((l) => [
      l.de_para_id,
      { especialidades: l.especialidades, procedimentos: Number(l.procedimentos), meses: Number(l.meses), ...sugerirMarcacao({ especialidades: l.especialidades, procedimentos: Number(l.procedimentos) }) },
    ]),
  );
}
