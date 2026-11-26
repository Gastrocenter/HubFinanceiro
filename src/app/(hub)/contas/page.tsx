import { Suspense } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { formatarReais } from "@/dominio/formatar-reais";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { formatarData as dataBr } from "@/dominio/formatar-data";
import { lerTudo } from "@/lib/ler-tudo";
import type { SituacaoDaConta } from "@/contas/ler-contas";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Status } from "@/components/status";
import { Vazio } from "@/components/vazio";

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
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Contas a pagar e a receber</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Do ProDoctor, só leitura, pelo mês de vencimento. De paciente o Hub não guarda nome nem histórico: aparece só
        como &quot;Paciente&quot;.
      </p>

      {mes ? (
        <>
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Mês de vencimento">
            {disponiveis.map((m) => (
              <Link key={m} href={`/contas?mes=${m}`} aria-current={m === mes ? "page" : undefined}
                className={`rounded-lg border px-3 py-1 ${m === mes ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {rotuloDoMes(m)}
              </Link>
            ))}
          </nav>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cartoes.map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(valor)}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Por grupo de receita/despesa em {rotuloDoMes(mes)}</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Natureza</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Contas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Efetivado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumo.map((l) => (
                    <TableRow key={`${l.natureza}:${l.situacao}:${l.grupo}`}>
                      <TableCell>{l.natureza === "pagar" ? "A pagar" : l.natureza === "receber" ? "A receber" : "Outra"}</TableCell>
                      <TableCell>{l.situacao}</TableCell>
                      <TableCell>{l.nome_grupo || l.grupo || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.contas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarReais(l.valor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarReais(l.efetivado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Contas a pagar com vencimento em {rotuloDoMes(mes)}</h2>
            {aPagar.length === 0 ? (
              <Vazio titulo="Nenhuma conta a pagar neste mês" descricao={`Não há título a pagar com vencimento em ${rotuloDoMes(mes)}.`} />
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Nº</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aPagar.map((c) => (
                      <TableRow key={`${c.codigo_local}:${c.numero}`}>
                        <TableCell className="tabular-nums">{dataBr(c.data_vencimento)}</TableCell>
                        <TableCell className="tabular-nums">{c.numero}</TableCell>
                        <TableCell>{c.cliente_fornecedor ?? "—"}</TableCell>
                        <TableCell>{c.nome_grupo || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatarReais(c.valor)}</TableCell>
                        <TableCell>{c.situacao === "PAGA" ? <Status tom="sucesso">Paga em {dataBr(c.data_efetivacao)}</Status> : <Status tom="neutro">Em aberto</Status>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      ) : (
        <Vazio titulo="Ainda não há contas sincronizadas" descricao="As contas a pagar e a receber aparecem aqui depois da sincronização com o ProDoctor." />
      )}
    </div>
  );
}

export default function Contas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela indicadores={4} tabelas={2} largura="max-w-6xl" />}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
