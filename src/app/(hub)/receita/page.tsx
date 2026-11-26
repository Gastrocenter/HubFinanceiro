import { Suspense } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { arredondarParaCentavos, formatarReais } from "@/dominio/formatar-reais";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Status } from "@/components/status";
import { Vazio } from "@/components/vazio";

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
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">Receita</h1>
        <Vazio titulo="Ainda não há receita sincronizada" descricao="A receita aparece aqui depois da primeira sincronização com o ProDoctor." />
      </div>
    );
  }

  const { data, error } = await db.rpc("resumo_receita", { p_mes: mes });
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as Linha[];
  const total = linhas.find((l) => l.agrupamento === "total");
  const unidades = linhas.filter((l) => l.agrupamento === "unidade").sort(porBruto);
  const profissionais = linhas.filter((l) => l.agrupamento === "profissional").sort(porBruto);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Receita por competência</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Procedimentos do ProDoctor pela data do atendimento. Líquido = bruto − glosa + recuperado.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Mês">
        {disponiveis.map((m) => (
          <Link
            key={m}
            href={`/receita?mes=${m}`}
            aria-current={m === mes ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 ${m === mes ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {rotuloDoMes(m)}
          </Link>
        ))}
      </nav>

      {total && (
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([["Bruto", total.bruto], ["Glosa", total.glosa], ["Recuperado", total.recuperado], ["Líquido", total.liquido]] as const).map(
            ([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(valor)}</dd>
              </div>
            ),
          )}
        </dl>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{total?.linhas ?? 0} procedimentos em {rotuloDoMes(mes)}</p>

      <Tabela titulo="Por unidade" linhas={unidades} total={total} />
      <Tabela titulo="Por profissional" linhas={profissionais} total={total} mostrarMedico />
    </div>
  );
}

function Tabela({
  titulo,
  linhas,
  total,
  mostrarMedico = false,
}: {
  titulo: string;
  linhas: Linha[];
  /** Linha "total" do banco: os grupos particionam a mesma base, então somam exatamente isto. */
  total?: Linha;
  mostrarMedico?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Proced.</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Glosa</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={`${l.agrupamento}-${l.id ?? "sem"}`}>
                <TableCell>
                  {l.nome}
                  {l.id === null && <Status tom="erro" className="ml-2">sem de-para</Status>}
                  {mostrarMedico && l.id !== null && l.eh_medico === null && (
                    <Status tom="atencao" className="ml-2">a revisar</Status>
                  )}
                  {mostrarMedico && l.eh_medico === false && (
                    <Status tom="neutro" className="ml-2">não é médico</Status>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.linhas}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(l.bruto)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(l.glosa)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(l.liquido)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {total && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{total.linhas}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(total.bruto)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(total.glosa)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(total.liquido)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </section>
  );
}

export default function Receita({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela indicadores={4} tabelas={2} />}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
