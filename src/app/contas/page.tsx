import { Suspense } from "react";
import Link from "next/link";
import { formatarReais } from "@/dominio/formatar-reais";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { formatarData as dataBr } from "@/dominio/formatar-data";
import { lerTudo } from "@/lib/ler-tudo";
import type { SituacaoDaConta } from "@/contas/ler-contas";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

type LinhaDoResumo = {
  natureza: "pagar" | "receber" | "outra";
  situacao: SituacaoDaConta | string;
  grupo: string;
  nome_grupo: string;
  contas: number;
  valor: string;
  efetivado: string;
};

type Totais = { a_pagar: string; pago: string; a_receber: string; recebido: string };

type ContaAPagar = {
  codigo_local: string;
  numero: string;
  data_vencimento: string | null;
  data_efetivacao: string | null;
  situacao: SituacaoDaConta | string;
  cliente_fornecedor: string | null;
  nome_grupo: string;
  valor: string;
  efetivado: string | null;
};

const mesEmSaoPaulo = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);


async function Conteudo({ busca }: { busca: Promise<{ mes?: string }> }) {
  await exigirAcesso("ver_contas");
  const db = criarClienteAdmin();
  const { data: meses, error: e1 } = await db.rpc("meses_com_contas");
  if (e1) throw new Error(e1.message);
  const disponiveis = (meses ?? []) as string[];
  const pedido = (await busca).mes;
  const atual = mesEmSaoPaulo();
  const mes = pedido && disponiveis.includes(pedido) ? pedido : disponiveis.includes(atual) ? atual : disponiveis[0];

  let resumo: LinhaDoResumo[] = [];
  let aPagar: ContaAPagar[] = [];
  let totais: Totais | null = null;
  if (mes) {
    const [r, t, p] = await Promise.all([
      db.rpc("resumo_contas", { p_mes: mes }),
      db.rpc("totais_contas", { p_mes: mes }).single(),
      // Página a página: o PostgREST corta uma resposta em 1000 linhas. A ordem vem do SQL.
      lerTudo((de, ate) => db.rpc("contas_a_pagar_do_mes", { p_mes: mes }).range(de, ate), `ler contas a pagar de ${mes}`),
    ]);
    if (r.error) throw new Error(r.error.message);
    if (t.error) throw new Error(t.error.message);
    resumo = (r.data ?? []) as LinhaDoResumo[];
    totais = t.data as Totais;
    aPagar = p as ContaAPagar[];
  }
  // Os totais vêm somados do banco, em numeric exato (ADR-0004).
  const cartoes = totais
    ? ([
        ["A pagar (em aberto)", totais.a_pagar],
        ["Pago", totais.pago],
        ["A receber (em aberto)", totais.a_receber],
        ["Recebido", totais.recebido],
      ] as const)
    : [];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/painel" className="text-sm underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold">Contas a pagar e a receber</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Do ProDoctor, só leitura, pelo mês de vencimento. De paciente o Hub não guarda nome nem histórico: aparece só
        como &quot;Paciente&quot;.
      </p>

      {mes ? (
        <>
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Mês de vencimento">
            {disponiveis.map((m) => (
              <Link key={m} href={`/contas?mes=${m}`} aria-current={m === mes ? "page" : undefined}
                className={`rounded border px-3 py-1 ${m === mes ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}>
                {rotuloDoMes(m)}
              </Link>
            ))}
          </nav>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cartoes.map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded border border-neutral-200 p-4">
                <dt className="text-xs uppercase tracking-wide text-neutral-500">{rotulo}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(valor)}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Por grupo de receita/despesa em {rotuloDoMes(mes)}</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="py-2 pr-4">Natureza</th>
                    <th className="pr-4">Situação</th>
                    <th className="pr-4">Grupo</th>
                    <th className="pr-4 text-right">Contas</th>
                    <th className="pr-4 text-right">Valor</th>
                    <th className="pr-4 text-right">Efetivado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.map((l) => (
                    <tr key={`${l.natureza}:${l.situacao}:${l.grupo}`} className="border-b border-neutral-200">
                      <td className="py-2 pr-4">{l.natureza === "pagar" ? "A pagar" : l.natureza === "receber" ? "A receber" : "Outra"}</td>
                      <td className="pr-4">{l.situacao}</td>
                      <td className="pr-4">{l.nome_grupo || l.grupo || "—"}</td>
                      <td className="pr-4 text-right tabular-nums">{l.contas}</td>
                      <td className="pr-4 text-right tabular-nums">{formatarReais(l.valor)}</td>
                      <td className="pr-4 text-right tabular-nums">{formatarReais(l.efetivado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Contas a pagar com vencimento em {rotuloDoMes(mes)}</h2>
            {aPagar.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">Nenhuma conta a pagar neste mês.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="py-2 pr-4">Vencimento</th>
                      <th className="pr-4">Nº</th>
                      <th className="pr-4">Fornecedor</th>
                      <th className="pr-4">Grupo</th>
                      <th className="pr-4 text-right">Valor</th>
                      <th className="pr-4">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aPagar.map((c) => (
                      <tr key={`${c.codigo_local}:${c.numero}`} className="border-b border-neutral-200">
                        <td className="py-2 pr-4 tabular-nums">{dataBr(c.data_vencimento)}</td>
                        <td className="pr-4 tabular-nums">{c.numero}</td>
                        <td className="pr-4">{c.cliente_fornecedor ?? "—"}</td>
                        <td className="pr-4">{c.nome_grupo || "—"}</td>
                        <td className="pr-4 text-right tabular-nums">{formatarReais(c.valor)}</td>
                        <td className="pr-4">{c.situacao === "PAGA" ? `Paga em ${dataBr(c.data_efetivacao)}` : "Em aberto"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="mt-4 text-sm text-neutral-600">Ainda não há contas sincronizadas.</p>
      )}
    </main>
  );
}

export default function Contas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
