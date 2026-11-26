import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { empresasConfiguradas } from "@/sync/empresas";
import { enfileirarRepasses, processarFila } from "@/sync/fila";
import { normalizarRepassesDoJob } from "@/repasse/normalizar";
import { somarValores } from "@/dominio/valor";

/**
 * S6 (issue 07): carga real de repasses, um job por mês, (API → Hub) conferida por um caminho independente
 * (SQL sobre o bruto). Só roda com RODAR_SYNC_REAL=1, e só depois do deploy do código que normaliza
 * (senão o agendador de produção pode pegar o job e concluí-lo sem normalizar). MESES_CARGA: meses separados por
 * vírgula (padrão 2026-10); para a carga de 12 meses, passe os 12 com ROTULO_CARGA=carga-inicial.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecret = process.env.SUPABASE_SECRET_KEY;
const empresa = empresasConfiguradas(process.env)[0];
const meses = (process.env.MESES_CARGA ?? "2026-10").split(",").map((m) => m.trim());
const rotulo = process.env.ROTULO_CARGA ?? `teste-s6-${Date.now()}`;
const ligado = process.env.RODAR_SYNC_REAL === "1" && Boolean(url && chaveSecret && empresa);

describe.skipIf(!ligado)(`carga real dos repasses de ${meses.join(", ")} (S6)`, () => {
  it("grava todas as linhas, o total ao profissional e os títulos batem com o bruto, e repetir não muda nada", async () => {
    const db = createClient(url!, chaveSecret!, { auth: { persistSession: false } });

    const criados = await enfileirarRepasses(db, empresa, meses, rotulo);
    expect(criados).toBe(meses.length);
    const processados = [];
    while (processados.length < meses.length) {
      const resumo = await processarFila({ db, prazoFinal: Date.now() + 200_000 });
      const meus = resumo.processados.filter((p) => p.rota.endsWith("/Exportacoes/Repasses"));
      if (resumo.processados.length === 0) break;
      processados.push(...meus.filter((p) => p.resultado === "concluido"));
    }
    expect(processados).toHaveLength(meses.length);

    for (const meu of processados) {
      const { data: conferencia, error } = await db.rpc("conferir_repasse_do_job", { p_job_id: Number(meu.jobId) });
      if (error) throw error;
      const c = conferencia as Record<string, string | number>;
      console.log("conferência de repasses:", JSON.stringify(c));
      expect(c.linhas_hub, String(c.mes)).toBe(c.linhas_bruto);
      expect(c.total_hub, String(c.mes)).toBe(c.total_bruto);
      expect(c.titulos_hub, String(c.mes)).toBe(c.titulos_bruto);
      // Os títulos somam exato o que veio do ProDoctor (o arredondamento é só por título).
      expect(somarValores([String(c.total_titulos)]), String(c.mes)).toBe(somarValores([String(c.total_bruto)]));

      const { data: job } = await db.from("sync_jobs").select("id, empresa, corpo").eq("id", Number(meu.jobId)).single();
      const segunda = await normalizarRepassesDoJob(db, { id: String(job!.id), empresa: job!.empresa, corpo: job!.corpo });
      expect({ novos: segunda.novos, alterados: segunda.alterados, sumiram: segunda.sumiram }).toEqual({ novos: 0, alterados: 0, sumiram: 0 });
    }
  }, 1_800_000);
});
