import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { empresasConfiguradas } from "@/sync/empresas";
import { enfileirarProcedimentos, processarFila } from "@/sync/fila";
import { normalizarProcedimentosDoJob } from "@/receita/normalizar";

/**
 * S6: carga real de um mês (API → Hub) conferida por caminhos independentes.
 * Só roda com RODAR_SYNC_REAL=1. MES_CARGA define o mês (padrão 2026-10).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecret = process.env.SUPABASE_SECRET_KEY;
const empresa = empresasConfiguradas(process.env)[0];
const mes = process.env.MES_CARGA ?? "2026-10";
const ligado = process.env.RODAR_SYNC_REAL === "1" && Boolean(url && chaveSecret && empresa);

describe.skipIf(!ligado)(`carga real da receita de ${mes} (S6)`, () => {
  it("grava todas as linhas, o total bate com a soma feita em SQL sobre o bruto, e repetir não muda nada", async () => {
    const db = createClient(url!, chaveSecret!, { auth: { persistSession: false } });

    const criados = await enfileirarProcedimentos(db, empresa, [mes], `teste-s6-${Date.now()}`);
    expect(criados).toBe(1);
    const resumo = await processarFila({ db, prazoFinal: Date.now() + 200_000 });
    const meu = resumo.processados.find((p) => p.rota.endsWith("ProcedimentosContasPacientes"));
    expect(meu?.resultado).toBe("concluido");

    const { data: conferencia, error } = await db.rpc("conferir_receita_do_job", { p_job_id: Number(meu!.jobId) });
    if (error) throw error;
    const c = conferencia as { linhas_bruto: number; linhas_hub: number; total_bruto: string; total_hub: string };
    console.log(`conferência ${mes}:`, JSON.stringify(c));
    expect(c.linhas_hub).toBe(c.linhas_bruto);
    expect(c.total_hub).toBe(c.total_bruto);

    const { data: job } = await db.from("sync_jobs").select("id, empresa, corpo").eq("id", Number(meu!.jobId)).single();
    const segunda = await normalizarProcedimentosDoJob(db, { id: String(job!.id), empresa: job!.empresa, corpo: job!.corpo });
    expect({ novos: segunda.novos, alterados: segunda.alterados, sumiram: segunda.sumiram }).toEqual({ novos: 0, alterados: 0, sumiram: 0 });
  }, 300_000);
});
