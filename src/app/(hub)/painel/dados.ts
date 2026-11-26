import "server-only";
import { cache } from "react";
import { lerSincronizacoes } from "@/conferencia/ler-sincronizacoes";
import type { ValorExato } from "@/dominio/valor";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/** Meses no gráfico de receita do painel. */
export const MESES_NO_GRAFICO = 6;

/** "2026-11": o mês de hoje no fuso da clínica, para marcar o mês que ainda está em andamento. */
export function mesCorrente(agora = new Date()): string {
  return agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

export type ReceitaDoMes = { mes: string; bruto: ValorExato; glosa: ValorExato; liquido: ValorExato; procedimentos: number };

type LinhaDoResumo = { agrupamento: string; linhas: number; bruto: string; glosa: string; liquido: string };

/**
 * Totais dos últimos meses com receita, do mais antigo ao mais recente. Usa o mesmo `resumo_receita` da tela de
 * receita (linha "total"), então os números batem com ela. `cache` divide a leitura entre o indicador e o gráfico.
 */
export const lerReceitaPorMes = cache(async (): Promise<ReceitaDoMes[]> => {
  const db = criarClienteAdmin();
  const { data: meses, error } = await db.rpc("meses_com_receita");
  if (error) throw new Error(error.message);
  const recentes = ((meses ?? []) as string[]).slice(0, MESES_NO_GRAFICO).reverse();
  return Promise.all(
    recentes.map(async (mes) => {
      const { data, error: e } = await db.rpc("resumo_receita", { p_mes: mes });
      if (e) throw new Error(e.message);
      const total = ((data ?? []) as LinhaDoResumo[]).find((l) => l.agrupamento === "total");
      return {
        mes,
        bruto: total?.bruto ?? "0",
        glosa: total?.glosa ?? "0",
        liquido: total?.liquido ?? "0",
        procedimentos: total?.linhas ?? 0,
      };
    }),
  );
});

export type RepasseDoMes = { mes: string; centavos: string; titulos: number };

/** Total a pagar do mês de repasse mais recente, em centavos já arredondados por título (como na tela de repasses). */
export async function lerRepasseDoMes(): Promise<RepasseDoMes | null> {
  const db = criarClienteAdmin();
  const { data: meses, error } = await db.rpc("meses_com_repasse");
  if (error) throw new Error(error.message);
  const mes = ((meses ?? []) as string[])[0];
  if (!mes) return null;
  const { data, error: e } = await db.rpc("resumo_repasses", { p_mes: mes });
  if (e) throw new Error(e.message);
  const total = ((data ?? []) as { agrupamento: string; titulos: number; total_centavos: string }[]).find(
    (l) => l.agrupamento === "total",
  );
  return { mes, centavos: total?.total_centavos ?? "0", titulos: total?.titulos ?? 0 };
}

/** Quantas pendências estão abertas na conferência. */
export async function contarPendenciasAbertas(): Promise<number> {
  const db = criarClienteAdmin();
  const { count, error } = await db.from("pendencias").select("id", { count: "exact", head: true }).eq("estado", "aberta");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Rotas do agendamento em dia e paradas (mais de 24 h sem concluir). */
export async function lerSaudeDasSincronizacoes(): Promise<{ total: number; paradas: string[] }> {
  const status = await lerSincronizacoes(criarClienteAdmin(), new Date());
  const variasEmpresas = new Set(status.map((s) => s.empresa)).size > 1;
  return {
    total: status.length,
    paradas: status.filter((s) => s.parado).map((s) => (variasEmpresas ? `${s.nome} (${s.empresa})` : s.nome)),
  };
}
