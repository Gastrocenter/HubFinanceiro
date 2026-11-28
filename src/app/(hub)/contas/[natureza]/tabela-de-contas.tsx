"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import { cn } from "cn";
import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Status } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatarReais } from "@/dominio/formatar-reais";
import { alternar, comFiltros, SITUACOES, type FiltrosDeContas, type SituacaoDoFiltro } from "@/contas/filtros";

export type ContaDaTabela = {
  id: string;
  /** Datas ISO para ordenar; o texto é o que aparece. */
  entrada: string;
  entradaTexto: string;
  vencimento: string;
  vencimentoTexto: string;
  efetivacao: string;
  efetivacaoTexto: string;
  numero: string;
  pessoa: string;
  categoria: string;
  item: string;
  /** Texto exato (ADR-0004). */
  valor: string;
  situacao: SituacaoDoFiltro;
};

type Opcao = { slug: string; nome: string };

/**
 * Filtro no cabeçalho da coluna: escreve no endereço, o mesmo estado do painel e do menu de categorias (D-7).
 * Sem o filtro, a tabela mostraria só um recorte do que os cartões somam.
 */
function FiltroNoCabecalho({ titulo, opcoes, marcadas, hrefDe }: {
  titulo: string; opcoes: Opcao[]; marcadas: string[]; hrefDe: (proximas: string[]) => string;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-mx-2 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          {titulo}
          <Filter className={cn("size-3.5", marcadas.length === 0 && "opacity-50")} aria-hidden />
          {marcadas.length > 0 && <span className="tabular-nums">· {marcadas.length}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel>Filtrar por {titulo.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {opcoes.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.slug}
            checked={marcadas.includes(o.slug)}
            onCheckedChange={() => router.push(hrefDe(alternar(marcadas, o.slug)))}
          >
            {o.nome}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const c = colunasDe<ContaDaTabela>();

export function TabelaDeContas({ contas, caminho, filtros, hoje, categorias, rotuloEfetivacao, rotuloEfetivada, rotuloPessoa }: {
  contas: ContaDaTabela[];
  caminho: string;
  filtros: FiltrosDeContas;
  hoje: string;
  categorias: Opcao[];
  rotuloEfetivacao: string;
  rotuloEfetivada: string;
  rotuloPessoa: string;
}) {
  const colunas = useMemo(() => {
    const situacoes: Opcao[] = [
      { slug: "aberta", nome: "Em aberto" },
      { slug: "vencida", nome: "Vencida" },
      { slug: "efetivada", nome: rotuloEfetivada },
    ];
    const data = (id: "entrada" | "vencimento" | "efetivacao", titulo: string) =>
      c.accessor(id, {
        meta: { rotulo: titulo },
        header: ({ column }) => <DataTableColumnHeader column={column} titulo={titulo} />,
        cell: ({ row }) => <span className="tabular-nums">{row.original[`${id}Texto`]}</span>,
        sortFn: "text",
        enableGlobalFilter: false,
      });
    return c.columns([
      data("entrada", "Entrada"),
      data("vencimento", "Vencimento"),
      data("efetivacao", rotuloEfetivacao),
      c.accessor("numero", {
        meta: { rotulo: "Nº" },
        header: ({ column }) => <DataTableColumnHeader column={column} titulo="Nº" />,
        cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        sortFn: "alphanumeric",
      }),
      c.accessor("pessoa", {
        meta: { rotulo: rotuloPessoa },
        header: ({ column }) => <DataTableColumnHeader column={column} titulo={rotuloPessoa} />,
      }),
      c.accessor("categoria", {
        meta: { rotulo: "Categoria" },
        header: () => (
          <FiltroNoCabecalho
            titulo="Categoria"
            opcoes={categorias}
            marcadas={filtros.categorias}
            hrefDe={(proximas) => comFiltros(caminho, filtros, { categorias: proximas }, hoje)}
          />
        ),
      }),
      c.accessor("item", {
        meta: { rotulo: "Item" },
        header: ({ column }) => <DataTableColumnHeader column={column} titulo="Item" />,
      }),
      c.accessor("valor", {
        meta: { rotulo: "Valor", alinhar: "direita" },
        header: ({ column }) => <DataTableColumnHeader column={column} titulo="Valor" />,
        cell: ({ getValue }) => formatarReais(getValue()),
        sortFn: "valorExato",
        enableGlobalFilter: false,
      }),
      c.accessor("situacao", {
        meta: { rotulo: "Situação" },
        header: () => (
          <FiltroNoCabecalho
            titulo="Situação"
            opcoes={situacoes}
            marcadas={filtros.situacoes}
            hrefDe={(proximas) =>
              comFiltros(caminho, filtros, { situacoes: SITUACOES.filter((s) => proximas.includes(s)) }, hoje)
            }
          />
        ),
        cell: ({ row }) =>
          row.original.situacao === "efetivada" ? (
            <Status tom="sucesso">{rotuloEfetivada} em {row.original.efetivacaoTexto}</Status>
          ) : row.original.situacao === "vencida" ? (
            <Status tom="erro">Vencida</Status>
          ) : (
            <Status tom="neutro">Em aberto</Status>
          ),
        enableGlobalFilter: false,
      }),
    ]);
  }, [caminho, filtros, hoje, categorias, rotuloEfetivacao, rotuloEfetivada, rotuloPessoa]);

  return (
    <DataTable
      columns={colunas}
      data={contas}
      getRowId={(l) => l.id}
      busca={{ placeholder: `Buscar por ${rotuloPessoa.toLowerCase()}, nº, item…` }}
      escolherColunas
      tamanhoPagina={50}
      densidade="compacta"
      vazio="Nenhuma conta com esses filtros."
    />
  );
}
