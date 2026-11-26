import type { SupabaseClient } from "@supabase/supabase-js";
import { sugerirMarcacao, type Sugestao } from "./sugerir-marcacao";

export type SinaisComSugestao = { especialidades: string[]; procedimentos: number; meses: number } & Sugestao;

/** Sinais e sugestão por de-para de profissional, calculados no servidor. */
export async function carregarSugestoes(db: SupabaseClient): Promise<Map<number, SinaisComSugestao>> {
  const { data, error } = await db.rpc("sinais_dos_profissionais");
  if (error) throw new Error(`ler sinais dos profissionais: ${error.message}`);
  const linhas = (data ?? []) as { de_para_id: number; especialidades: string[]; procedimentos: number; meses: number }[];
  return new Map(
    linhas.map((l) => [
      l.de_para_id,
      { especialidades: l.especialidades, procedimentos: Number(l.procedimentos), meses: Number(l.meses), ...sugerirMarcacao({ especialidades: l.especialidades, procedimentos: Number(l.procedimentos) }) },
    ]),
  );
}
