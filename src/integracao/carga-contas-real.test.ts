import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { empresasConfiguradas } from "@/sync/empresas";
import { enfileirarCadastros, enfileirarContas, JOBS_DE_CADASTRO, processarFila } from "@/sync/fila";
import { normalizarContasDoJob } from "@/contas/normalizar";
import { somarValores } from "@/dominio/valor";
import { ROTAS_DO_PLANO } from "@/contas/ler-plano-financeiro";

/**
 * S6 (issue 08b): carga real de contas a pagar/receber, um job por mês de inclusão, conferida por um caminho
 * independente (SQL sobre o bruto). Só roda com RODAR_SYNC_REAL=1, e só depois do deploy do código que normaliza.
 * Primeiro o plano financeiro (filtro obrigatório), depois as contas. MESES_CARGA: meses separados por vírgula.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveSecret = process.env.SUPABASE_SECRET_KEY;
const empresa = empresasConfiguradas(process.env)[0];
const meses = (process.env.MESES_CARGA ?? "2026-10").split(",").map((m) => m.trim());
const rotulo = process.env.ROTULO_CARGA ?? `teste-s6-${Date.now()}`;
const ligado = process.env.RODAR_SYNC_REAL === "1" && Boolean(url && chaveSecret && empresa);
/** Forma canônica de um valor exato ("30.00" e "30" são iguais), para comparar o Hub com o bruto. */
const valorCanonico = (v: string | number) => somarValores([String(v)]);

describe.skipIf(!ligado)(`carga real das contas a pagar/receber de ${meses.join(", ")} (S6)`, () => {
  it("grava todas as contas com crédito e débito iguais ao bruto, sem dado de paciente, e repetir não muda nada", async () => {
    const db = createClient(url!, chaveSecret!, { auth: { persistSession: false } });

    // O agendador de produção pode pegar parte dos jobs em paralelo: espera pelo estado no banco.
    async function esperar(chaves: string[]) {
      const prazo = Date.now() + 1_500_000;
      let jobs: { id: number; estado: string }[] = [];
      while (Date.now() < prazo) {
        const { data, error } = await db.from("sync_jobs").select("id, estado").in("chave_idempotencia", chaves).order("id");
        if (error) throw error;
        jobs = data ?? [];
        if (jobs.length === chaves.length && jobs.every((j) => j.estado === "concluido" || j.estado === "falhou")) break;
        const resumo = await processarFila({ db, prazoFinal: Date.now() + 200_000 });
        if (resumo.processados.length === 0) await new Promise((r) => setTimeout(r, 5_000));
      }
      return jobs;
    }

    const dia = new Date().toISOString().slice(0, 10);
    const sufixo = `:${rotulo}`;
    await enfileirarCadastros(db, [empresa], dia, sufixo);
    const rotasDoPlano = new Set(Object.values(ROTAS_DO_PLANO).map((p) => p.rota));
    const cadastros = await esperar(JOBS_DE_CADASTRO.map((c) => `cadastros:${empresa}:${c.rota}:${dia}${sufixo}`));
    expect(cadastros.map((j) => j.estado)).toEqual(JOBS_DE_CADASTRO.map(() => "concluido"));
    const { count: noPlano } = await db.from("plano_financeiro").select("*", { count: "exact", head: true }).eq("empresa", empresa);
    expect(noPlano, `plano financeiro (${[...rotasDoPlano].join(", ")})`).toBeGreaterThan(0);

    expect(await enfileirarContas(db, empresa, meses, rotulo)).toBe(meses.length);
    const jobs = await esperar(meses.map((mes) => `contas:${empresa}:${mes}:${rotulo}`));
    expect(jobs.map((j) => j.estado)).toEqual(meses.map(() => "concluido"));

    for (const { id } of jobs) {
      const { data: conferencia, error } = await db.rpc("conferir_contas_do_job", { p_job_id: id });
      if (error) throw error;
      const c = conferencia as Record<string, string | number>;
      console.log("conferência de contas:", JSON.stringify({ mes: c.mes, linhas: c.linhas_hub }));
      expect(c.linhas_hub, String(c.mes)).toBe(c.linhas_bruto);
      expect(c.linhas_fora_do_mes, `${c.mes}: conta de outro mês de inclusão no bruto`).toBe(0);
      for (const campo of ["credito", "debito", "efetivado"]) {
        expect(valorCanonico(c[`${campo}_hub`]), `${c.mes} ${campo}`).toBe(valorCanonico(c[`${campo}_bruto`]));
      }

      const { data: job } = await db.from("sync_jobs").select("id, empresa, corpo").eq("id", id).single();
      const segunda = await normalizarContasDoJob(db, { id: String(job!.id), empresa: job!.empresa, corpo: job!.corpo });
      expect({ novos: segunda.novos, alterados: segunda.alterados, sumiram: segunda.sumiram }).toEqual({ novos: 0, alterados: 0, sumiram: 0 });
    }

    // D-1: nada de paciente no Hub (o banco também recusa por constraint).
    const { count: comNome } = await db.from("contas_pagar_receber").select("*", { count: "exact", head: true })
      .eq("empresa", empresa).eq("tipo_cliente_fornecedor", "Paciente").not("cliente_fornecedor", "is", null);
    expect(comNome).toBe(0);
  }, 1_800_000);
});
