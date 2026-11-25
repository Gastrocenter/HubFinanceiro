import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { empresasConfiguradas } from "@/sync/empresas";
import { CADASTROS, enfileirarCadastros, processarFila } from "@/sync/fila";
import { criarRepositorioPostgres } from "@/sync/repositorio-postgres";

/**
 * S4: sincronização real (API do ProDoctor → Supabase). Grava uma cópia real dos cadastros.
 * Só roda com RODAR_SYNC_REAL=1, para não criar cópias a cada `npm test`.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecret = process.env.SUPABASE_SECRET_KEY;
const empresas = empresasConfiguradas(process.env);
const ligado = process.env.RODAR_SYNC_REAL === "1" && Boolean(url && chaveSecret) && empresas.length > 0;

describe.skipIf(!ligado)("sincronização real dos cadastros (S4)", () => {
  it("enfileira sem duplicar, grava os três cadastros e não duplica página reprocessada", async () => {
    const db = createClient(url!, chaveSecret!, { auth: { persistSession: false } });
    const empresa = empresas[0];
    const sufixo = `:teste-s4:${Date.now()}`;
    const dia = new Date().toISOString().slice(0, 10);

    expect(await enfileirarCadastros(db, [empresa], dia, sufixo)).toBe(3);
    expect(await enfileirarCadastros(db, [empresa], dia, sufixo)).toBe(0); // idempotente

    const resumo = await processarFila({ db, prazoFinal: Date.now() + 120_000 });
    const meus = resumo.processados.filter((p) => p.empresa === empresa);
    expect(meus.map((p) => p.resultado)).toEqual(["concluido", "concluido", "concluido"]);

    for (const { jobId, rota } of meus) {
      const cadastro = CADASTROS.find((c) => c.rota === rota)!;
      const { data: paginas } = await db.from("prodoctor_payload_bruto").select("pagina, payload").eq("job_id", Number(jobId));
      expect(paginas?.map((p) => p.pagina), rota).toEqual([1]);
      const registros = (paginas![0].payload as { payload: Record<string, unknown[]> }).payload[cadastro.caminhoDaLista];
      expect(registros.length, rota).toBeGreaterThan(0);
    }

    // Reprocessar a mesma página não cria uma segunda linha.
    const primeiro = meus[0];
    const { data: original } = await db.from("prodoctor_payload_bruto").select("payload").eq("job_id", Number(primeiro.jobId)).single();
    const job = { id: primeiro.jobId, empresa, rota: primeiro.rota, corpo: { quantidade: 5000, somenteAtivos: true }, caminhoDaLista: "x", proximaPagina: 1 };
    await criarRepositorioPostgres(db).salvarPagina(job, 1, original!.payload);
    const { count } = await db.from("prodoctor_payload_bruto").select("*", { count: "exact", head: true }).eq("job_id", Number(primeiro.jobId));
    expect(count).toBe(1);
  }, 180_000);
});
