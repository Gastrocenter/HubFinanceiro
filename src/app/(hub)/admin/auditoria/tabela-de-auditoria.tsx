"use client";

import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";

export type EventoDeAuditoria = {
  id: number;
  /** ISO, para ordenar. */
  quando: string;
  quandoTexto: string;
  acao: string;
  usuario: string;
  detalhes: string;
};

const c = colunasDe<EventoDeAuditoria>();

const colunas = c.columns([
  c.accessor("quando", {
    meta: { rotulo: "Quando" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Quando" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.quandoTexto}</span>,
    enableGlobalFilter: false,
  }),
  c.accessor("acao", {
    meta: { rotulo: "Ação" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Ação" />,
  }),
  c.accessor("usuario", {
    meta: { rotulo: "Usuário" },
    header: "Usuário",
    enableSorting: false,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
  }),
  c.accessor("detalhes", {
    meta: { rotulo: "Detalhes" },
    header: "Detalhes",
    enableSorting: false,
    cell: ({ getValue }) => (
      <code className="block max-w-xl min-w-64 font-mono text-xs break-all whitespace-normal text-muted-foreground">
        {getValue()}
      </code>
    ),
  }),
]);

export function TabelaDeAuditoria({ eventos }: { eventos: EventoDeAuditoria[] }) {
  return (
    <DataTable
      className="mt-6"
      columns={colunas}
      data={eventos}
      getRowId={(e) => String(e.id)}
      busca={{ placeholder: "Buscar ação, usuário ou detalhe…" }}
      tamanhoPagina={25}
      densidade="compacta"
      vazio="Nenhum evento com esse texto."
    />
  );
}
