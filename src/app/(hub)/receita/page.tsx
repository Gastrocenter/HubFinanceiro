import { Suspense } from "react";
import Link from "next/link";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { arredondarParaCentavos, formatarReais } from "@/dominio/formatar-reais";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

type Linha = {
  agrupamento: "total" | "unidade" | "profissional";
  id: number | null;
  nome: string;
  eh_medico: boolean | null;
  linhas: number;
  bruto: string;
  glosa: string;
  recuperado: string;
  liquido: string;
};


/** Maior bruto primeiro, comparando em centavos inteiros (sem ponto flutuante). */
function porBruto(a: Linha, b: Linha) {
  const d = arredondarParaCentavos(b.bruto) - arredondarParaCentavos(a.bruto);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

async function Conteudo({ busca }: { busca: Promise<{ mes?: string }> }) {
  await exigirAcesso("ver_receita");
  const db = criarClienteAdmin();
  const { data: meses, error: e1 } = await db.rpc("meses_com_receita");
  if (e1) throw new Error(e1.message);
  const disponiveis = (meses ?? []) as string[];
  const pedido = (await busca).mes;
  const mes = pedido && disponiveis.includes(pedido) ? pedido : disponiveis[0];

  if (!mes) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <Link href="/painel" className="text-sm underline">← Painel</Link>
        <h1 className="mt-2 text-2xl font-semibold">Receita</h1>
        <p className="mt-4 text-sm text-neutral-600">Ainda não há receita sincronizada.</p>
      </main>
    );
  }

  const { data, error } = await db.rpc("resumo_receita", { p_mes: mes });
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as Linha[];
  const total = linhas.find((l) => l.agrupamento === "total");
  const unidades = linhas.filter((l) => l.agrupamento === "unidade").sort(porBruto);
  const profissionais = linhas.filter((l) => l.agrupamento === "profissional").sort(porBruto);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/painel" className="text-sm underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold">Receita por competência</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Procedimentos do ProDoctor pela data do atendimento. Líquido = bruto − glosa + recuperado.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Mês">
        {disponiveis.map((m) => (
          <Link
            key={m}
            href={`/receita?mes=${m}`}
            aria-current={m === mes ? "page" : undefined}
            className={`rounded border px-3 py-1 ${m === mes ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
          >
            {rotuloDoMes(m)}
          </Link>
        ))}
      </nav>

      {total && (
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([["Bruto", total.bruto], ["Glosa", total.glosa], ["Recuperado", total.recuperado], ["Líquido", total.liquido]] as const).map(
            ([rotulo, valor]) => (
              <div key={rotulo} className="rounded border border-neutral-200 p-4">
                <dt className="text-xs uppercase tracking-wide text-neutral-500">{rotulo}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(valor)}</dd>
              </div>
            ),
          )}
        </dl>
      )}
      <p className="mt-2 text-xs text-neutral-500">{total?.linhas ?? 0} procedimentos em {rotuloDoMes(mes)}</p>

      <Tabela titulo="Por unidade" linhas={unidades} />
      <Tabela titulo="Por profissional" linhas={profissionais} mostrarMedico />
    </main>
  );
}

function Tabela({ titulo, linhas, mostrarMedico = false }: { titulo: string; linhas: Linha[]; mostrarMedico?: boolean }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-2 pr-4">Nome</th>
              <th className="pr-4 text-right">Proced.</th>
              <th className="pr-4 text-right">Bruto</th>
              <th className="pr-4 text-right">Glosa</th>
              <th className="pr-4 text-right">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={`${l.agrupamento}-${l.id ?? "sem"}`} className="border-b border-neutral-200">
                <td className="py-2 pr-4">
                  {l.id === null ? <span className="text-red-700">{l.nome}</span> : l.nome}
                  {mostrarMedico && l.id !== null && l.eh_medico === null && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">a revisar</span>
                  )}
                  {mostrarMedico && l.eh_medico === false && (
                    <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs">não é médico</span>
                  )}
                </td>
                <td className="pr-4 text-right tabular-nums">{l.linhas}</td>
                <td className="pr-4 text-right tabular-nums">{formatarReais(l.bruto)}</td>
                <td className="pr-4 text-right tabular-nums">{formatarReais(l.glosa)}</td>
                <td className="pr-4 text-right tabular-nums">{formatarReais(l.liquido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Receita({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
