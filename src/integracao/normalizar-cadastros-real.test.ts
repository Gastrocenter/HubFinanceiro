import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { ROTA_PARA_TIPO, normalizarCadastrosDoJob } from "@/cadastros/normalizar";
import { empresasConfiguradas } from "@/sync/empresas";

/**
 * Normaliza os jobs de cadastro concluídos mais recentes da empresa (dados reais) e prova a idempotência.
 * Só roda com RODAR_SYNC_REAL=1.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecret = process.env.SUPABASE_SECRET_KEY;
const empresa = empresasConfiguradas(process.env)[0];
const ligado = process.env.RODAR_SYNC_REAL === "1" && Boolean(url && chaveSecret && empresa);

describe.skipIf(!ligado)("normalização real dos cadastros (issue 05)", () => {
  it("cria o de-para a partir do último job de cada cadastro; rodar de novo não muda nada", async () => {
    const db = createClient(url!, chaveSecret!, { auth: { persistSession: false } });
    for (const rota of Object.keys(ROTA_PARA_TIPO)) {
      const { data: job } = await db
        .from("sync_jobs")
        .select("id, empresa, rota")
        .eq("empresa", empresa)
        .eq("rota", rota)
        .eq("estado", "concluido")
        .not("chave_idempotencia", "like", "%teste-s4%")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      expect(job, rota).toBeTruthy();
      const alvo = { id: String(job!.id), empresa: job!.empresa, rota: job!.rota };

      await normalizarCadastrosDoJob(db, alvo);
      const segunda = await normalizarCadastrosDoJob(db, alvo);
      expect(segunda, rota).toEqual({ tipo: ROTA_PARA_TIPO[rota], criados: 0, alterados: 0, sumiram: 0, voltaram: 0 });
    }
  }, 120_000);
});
