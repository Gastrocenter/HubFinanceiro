import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecret = process.env.SUPABASE_SECRET_KEY;
const EMPRESA_DE_TESTE = "TESTE_S2";

describe.skipIf(!url || !chaveSecret)("fila de jobs no Postgres (S2)", () => {
  const db = createClient(url!, chaveSecret!, { auth: { persistSession: false } });

  async function criarJob(campos: Record<string, unknown> = {}) {
    const { data, error } = await db
      .from("sync_jobs")
      .insert({ empresa: EMPRESA_DE_TESTE, rota: "/teste", caminho_da_lista: "x", ...campos })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as number;
  }

  async function reivindicar() {
    const { data, error } = await db.rpc("reivindicar_proximo_job", { p_posse_segundos: 60 });
    if (error) throw error;
    return (data as { id: number; empresa: string }[]).filter((j) => j.empresa === EMPRESA_DE_TESTE);
  }

  afterAll(async () => {
    await db.from("sync_jobs").delete().eq("empresa", EMPRESA_DE_TESTE);
  });

  it("8 rodadas em paralelo: exatamente uma pega o job", async () => {
    const id = await criarJob();
    const resultados = await Promise.all(Array.from({ length: 8 }, reivindicar));
    const pegaram = resultados.flat().filter((j) => j.id === id);
    expect(pegaram).toHaveLength(1);
  });

  it("job com posse vencida volta a ser pego", async () => {
    const id = await criarJob({ estado: "executando", posse_ate: new Date(Date.now() - 60_000).toISOString() });
    const pegos = (await reivindicar()).map((j) => j.id);
    expect(pegos).toContain(id);
  });

  it("erro passageiro volta para a fila; na 5ª tentativa vira falha", async () => {
    const id = await criarJob({ estado: "executando", tentativas: 3 });
    await db.rpc("registrar_erro_job", { p_id: id, p_mensagem: "503", p_definitivo: false });
    let { data } = await db.from("sync_jobs").select("estado, tentativas").eq("id", id).single();
    expect(data).toEqual({ estado: "pendente", tentativas: 4 });

    await db.rpc("registrar_erro_job", { p_id: id, p_mensagem: "503", p_definitivo: false });
    ({ data } = await db.from("sync_jobs").select("estado, tentativas").eq("id", id).single());
    expect(data).toEqual({ estado: "falhou", tentativas: 5 });
  });
});
