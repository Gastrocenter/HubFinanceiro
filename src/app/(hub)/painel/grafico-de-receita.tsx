import Link from "next/link";
import { cn } from "cn";
import { alturasDasBarras, ESCALA } from "@/dominio/grafico";
import { formatarReais } from "@/dominio/formatar-reais";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { lerReceitaPorMes, mesCorrente } from "./dados";

function Moldura({ children, descricao }: { children: React.ReactNode; descricao: string }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Receita líquida por mês</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function GraficoCarregando() {
  return (
    <Moldura descricao="Carregando os últimos meses…">
      <Skeleton className="h-56 rounded-xl" />
    </Moldura>
  );
}

/**
 * Barras desenhadas no servidor, sem biblioteca de gráfico: a altura sai de `alturasDasBarras`, que compara os
 * valores exatos em centavos (bigint). Cada barra leva à receita do mês e mostra o valor ao passar o mouse ou focar.
 */
export async function GraficoDeReceita() {
  const meses = await lerReceitaPorMes();
  if (meses.length === 0) {
    return (
      <Moldura descricao="A receita aparece aqui depois da primeira sincronização com o ProDoctor.">
        <div className="h-24" />
      </Moldura>
    );
  }
  const alturas = alturasDasBarras(meses.map((m) => m.liquido));
  const emAndamento = meses.at(-1)?.mes === mesCorrente() ? meses.at(-1)?.mes : undefined;

  return (
    <Moldura
      descricao={`Bruto − glosa + recuperado, nos últimos ${meses.length} meses com receita.${
        emAndamento ? ` ${rotuloDoMes(emAndamento)} ainda está em andamento.` : ""
      } Clique numa barra para abrir o mês.`}
    >
      <ol className="flex h-56 items-end gap-3 border-b border-border pt-8 sm:gap-6" aria-label="Receita líquida por mês">
        {meses.map((m, i) => {
          const rotulo = rotuloDoMes(m.mes);
          const valor = formatarReais(m.liquido);
          return (
            <li key={m.mes} className="flex h-full flex-1 flex-col justify-end">
              <Link
                href={`/receita?mes=${m.mes}`}
                aria-label={`${rotulo}${m.mes === emAndamento ? " (em andamento)" : ""}: ${valor}`}
                className="group relative flex h-full flex-col justify-end rounded-t-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background tabular-nums opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{ bottom: `${(alturas[i] / ESCALA) * 100}%` }}
                >
                  {valor}
                </span>
                <span
                  className={cn(
                    "w-full rounded-t-[4px] transition-opacity group-hover:opacity-80",
                    // Mês em andamento: mesma cor com listras, para não parecer queda.
                    m.mes === emAndamento
                      ? "bg-[repeating-linear-gradient(135deg,var(--chart-1)_0_6px,transparent_6px_10px)] ring-1 ring-chart-1 ring-inset"
                      : "bg-chart-1",
                  )}
                  style={{ height: `${(alturas[i] / ESCALA) * 100}%` }}
                />
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex gap-3 sm:gap-6" aria-hidden>
        {meses.map((m) => (
          <span key={m.mes} className="flex-1 text-center text-xs text-muted-foreground">
            {rotuloDoMes(m.mes)}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver como tabela</summary>
        <div className="mt-3 overflow-hidden rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Proced.</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Glosa</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell>{rotuloDoMes(m.mes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.procedimentos}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReais(m.bruto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReais(m.glosa)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReais(m.liquido)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </Moldura>
  );
}
