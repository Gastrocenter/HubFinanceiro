"use client";

import { useEffect, useRef } from "react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type Column,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Search } from "lucide-react";
import { cn } from "cn";
import { compararValores, type ValorExato } from "@/dominio/valor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface MetaDaColuna {
  /** Nome legível no menu de colunas. */
  rotulo?: string;
  /** Alinha cabeçalho e célula (valores à direita, com números tabulares). */
  alinhar?: "esquerda" | "direita";
}

type LinhaComValor = { getValue: <T>(id: string) => T };

/** Ordena uma coluna de ValorExato (texto) sem ponto flutuante. Nulos vão para o fim. */
function valorExato(a: LinhaComValor, b: LinhaComValor, id: string): number {
  const x = a.getValue<ValorExato | null>(id);
  const y = b.getValue<ValorExato | null>(id);
  if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
  return compararValores(x, y);
}

/**
 * Recursos do TanStack Table v9 que a DataTable usa. Fica fora do render (entrada estável).
 * Colunas de dinheiro usam `sortFn: "valorExato"`.
 */
export const recursosDaTabela = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    valorExato,
  },
  columnMeta: metaHelper<MetaDaColuna>(),
});

export type RecursosDaTabela = typeof recursosDaTabela;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TValue varia por coluna; é o tipo que o columnHelper.columns devolve.
export type ColunaDaTabela<TData extends RowData> = ColumnDef<RecursosDaTabela, TData, any>;

/** Helper tipado para declarar colunas: `const c = colunasDe<Recebivel>(); c.columns([c.accessor("id", {...})])`. */
export const colunasDe = <TData extends RowData>() => createColumnHelper<RecursosDaTabela, TData>();

export interface DataTableProps<TData extends RowData> {
  /** Declare fora do render (ou em useMemo): colunas novas a cada render refazem a tabela. */
  columns: ColunaDaTabela<TData>[];
  data: TData[];
  /** Id estável da linha (seleção sobrevive a ordenar e filtrar). Sem ele, usa o índice. */
  getRowId?: (linha: TData) => string;
  /** Mostra a busca, que procura em todas as colunas filtráveis. */
  busca?: { placeholder?: string };
  /** Linhas por página. `false` desliga a paginação. */
  tamanhoPagina?: number | false;
  /** Coluna de checkbox à esquerda. */
  selecionavel?: boolean;
  aoMudarSelecao?: (linhas: TData[]) => void;
  /** Menu para esconder e mostrar colunas. */
  escolherColunas?: boolean;
  densidade?: "normal" | "compacta";
  carregando?: boolean;
  /** O que mostrar sem nenhuma linha (ou nenhuma que passe na busca). */
  vazio?: React.ReactNode;
  /** Linha de rodapé (por exemplo, o total). Recebe as linhas que passam na busca. */
  rodape?: (linhas: TData[]) => React.ReactNode;
  className?: string;
}

const auxiliarGenerico = colunasDe<Record<string, unknown>>();
const colunaDeSelecao = auxiliarGenerico.display({
  id: "_selecao",
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllPageRowsSelected()
          ? true
          : table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : false
      }
      onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      aria-label="Selecionar todas as linhas da página"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(v) => row.toggleSelected(!!v)}
      aria-label="Selecionar linha"
    />
  ),
  enableSorting: false,
  enableHiding: false,
  enableGlobalFilter: false,
});

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  busca,
  tamanhoPagina = 10,
  selecionavel = false,
  aoMudarSelecao,
  escolherColunas = false,
  densidade = "normal",
  carregando = false,
  vazio = "Nenhum registro.",
  rodape,
  className,
}: DataTableProps<TData>) {
  const todasAsColunas = selecionavel
    ? [colunaDeSelecao as unknown as ColunaDaTabela<TData>, ...columns]
    : columns;

  // Estado interno da tabela (ordenação, busca, colunas, seleção, página); table.state o expõe ao render.
  const table = useTable({
    features: recursosDaTabela,
    data,
    columns: todasAsColunas,
    getRowId,
    enableRowSelection: selecionavel,
    manualPagination: tamanhoPagina === false,
    initialState: { pagination: { pageIndex: 0, pageSize: tamanhoPagina === false ? 10 : tamanhoPagina } },
  });

  // Avisa quem usa a tabela quando a seleção muda; o ref evita depender da identidade do callback.
  const aoMudar = useRef(aoMudarSelecao);
  useEffect(() => {
    aoMudar.current = aoMudarSelecao;
  });
  const selecao = table.state.rowSelection;
  useEffect(() => {
    aoMudar.current?.(table.getSelectedRowModel().rows.map((r) => r.original));
  }, [selecao, table]);

  const celula = densidade === "compacta" ? "py-1.5" : "py-2.5";
  const linhas = table.getRowModel().rows;
  const totalColunas = table.getVisibleLeafColumns().length;
  const selecionadas = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(busca || escolherColunas) && (
        <div className="flex items-center gap-2">
          {busca && (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={String(table.state.globalFilter ?? "")}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
                placeholder={busca.placeholder ?? "Buscar…"}
                aria-label={busca.placeholder ?? "Buscar na tabela"}
                className="pl-9"
              />
            </div>
          )}
          {escolherColunas && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  <Columns3 data-icon="inline-start" />
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {typeof c.columnDef.meta?.rotulo === "string" ? c.columnDef.meta.rotulo : c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table aria-busy={carregando || undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((grupo) => (
              <TableRow key={grupo.id} className="hover:bg-transparent">
                {grupo.headers.map((h) => {
                  const ordem = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      aria-sort={
                        h.column.getCanSort()
                          ? ordem === "asc"
                            ? "ascending"
                            : ordem === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                      className={cn(
                                                h.column.columnDef.meta?.alinhar === "direita" && "text-right",
                        h.column.id === "_selecao" && "w-10",
                      )}
                    >
                      {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {carregando ? (
              Array.from({ length: tamanhoPagina === false ? 5 : Math.min(tamanhoPagina, 5) }, (_, i) => (
                <TableRow key={`carregando-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: totalColunas }, (_, j) => (
                    <TableCell key={j} className={cn("px-4", celula)}>
                      <div className="h-4 w-full max-w-32 animate-pulse rounded-md bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : linhas.length ? (
              linhas.map((linha) => (
                <TableRow
                  key={linha.id}
                  data-state={linha.getIsSelected() ? "selected" : undefined}
                  className="data-[state=selected]:bg-accent"
                >
                  {linha.getVisibleCells().map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn(
                        "px-4",
                        celula,
                        c.column.columnDef.meta?.alinhar === "direita" && "text-right tabular-nums",
                      )}
                    >
                      <table.FlexRender cell={c} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColunas} className="h-28 text-center text-muted-foreground">
                  {vazio}
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {rodape && !carregando && linhas.length > 0 && (
            <TableFooter className="bg-muted/60">
              {rodape(table.getFilteredRowModel().rows.map((r) => r.original))}
            </TableFooter>
          )}
        </Table>
      </div>

      {(selecionavel || tamanhoPagina !== false) && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span aria-live="polite">
            {selecionavel
              ? `${selecionadas} de ${table.getFilteredRowModel().rows.length} selecionada(s)`
              : `${table.getFilteredRowModel().rows.length} registro(s)`}
          </span>
          {tamanhoPagina !== false && (
            <div className="flex items-center gap-2">
              <span>
                Página {table.state.pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Próxima página"
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Cabeçalho clicável que alterna a ordenação (crescente → decrescente → sem ordem). */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  titulo,
  className,
}: {
  column: Column<RecursosDaTabela, TData, TValue>;
  titulo: string;
  className?: string;
}) {
  if (!column.getCanSort()) return <span className={className}>{titulo}</span>;
  const ordem = column.getIsSorted();
  const Icone = ordem === "asc" ? ArrowUp : ordem === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "-mx-2 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
        column.columnDef.meta?.alinhar === "direita" && "ml-auto flex",
        className,
      )}
    >
      {titulo}
      <Icone className={cn("size-3.5", !ordem && "opacity-50")} aria-hidden />
    </Button>
  );
}
