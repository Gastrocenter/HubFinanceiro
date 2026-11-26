import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveDoProcedimento, type DiferencaDoMes, type ProcedimentoAtual } from "@/receita/diferenca-do-mes";
import { lerTudo } from "@/lib/ler-tudo";
import { detectarGlosaAposRepasse, type GlosaAposRepasse, type RepasseFeito } from "./detectar-glosa-apos-repasse";

/** Contas por consulta ao buscar repasses: mantém a URL do PostgREST curta. */
const CONTAS_POR_CONSULTA = 200;

/**
 * Procedimentos alterados que já têm repasse e cuja glosa mudou (L10, D-V). Só lê os repasses das contas
 * alteradas; o Hub não desconta nada, só abre a pendência.
 */
export async function glosasAposRepasse(
  db: SupabaseClient,
  empresa: string,
  dif: DiferencaDoMes,
  atuais: ProcedimentoAtual[],
): Promise<GlosaAposRepasse[]> {
  if (dif.alterados.length === 0) return [];
  const antes = new Map(atuais.map((a) => [chaveDoProcedimento(a.registro), a.registro]));
  const alterados = dif.alterados.map(({ registro }) => ({ antes: antes.get(chaveDoProcedimento(registro))!, depois: registro }));
  const contas = [...new Set(alterados.map((a) => a.depois.conta))];
  const repassados = new Map<string, RepasseFeito[]>();
  for (let i = 0; i < contas.length; i += CONTAS_POR_CONSULTA) {
    const lote = contas.slice(i, i + CONTAS_POR_CONSULTA);
    const linhas = await lerTudo(
      (de, ate) =>
        db
          .from("repasses")
          .select("id, codigo_local, conta, linha, numero_repasse, data_repasse, valor_repassado_medico:valor_repassado_medico::text")
          .eq("empresa", empresa)
          .eq("visto_na_ultima_sync", true)
          .in("conta", lote)
          .order("id")
          .range(de, ate),
      "ler repasses das contas alteradas",
    );
    for (const l of linhas as unknown as Record<string, string | null>[]) {
      const chave = chaveDoProcedimento({ codigoLocal: l.codigo_local!, conta: l.conta!, linha: l.linha! });
      const doProcedimento = repassados.get(chave) ?? [];
      doProcedimento.push({ numeroRepasse: l.numero_repasse!, dataRepasse: l.data_repasse!, valorRepassadoMedico: l.valor_repassado_medico });
      repassados.set(chave, doProcedimento);
    }
  }
  return detectarGlosaAposRepasse(alterados, repassados);
}
