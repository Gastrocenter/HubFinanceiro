"use client";

import { useMemo, useState } from "react";
import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Status } from "@/components/status";
import { BotaoDeEnvio, FormularioDeAcao } from "@/components/formulario-de-acao";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LinhaDeItem, Natureza } from "@/contas/categorias";
import { trocarCategoria } from "./acoes";

export type OpcaoDeCategoria = { id: number; nome: string };

const SEM_CATEGORIA = "";

function TrocarCategoria({ linha, natureza, opcoes }: { linha: LinhaDeItem; natureza: Natureza; opcoes: OpcaoDeCategoria[] }) {
  const atual = linha.categoriaId === null ? SEM_CATEGORIA : String(linha.categoriaId);
  const [aberto, setAberto] = useState(false);
  const [escolhida, setEscolhida] = useState(atual);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setEscolhida(atual);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Trocar a categoria de ${linha.item}`}>
          Trocar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <FormularioDeAcao acao={trocarCategoria} aoConcluir={() => setAberto(false)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Categoria do item</DialogTitle>
            <DialogDescription>
              {linha.item}. Vale para o item em todas as unidades ({linha.unidades}) e para as {linha.contas} contas que
              caem nele, nas páginas de contas.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="natureza" value={natureza} />
          <input type="hidden" name="item" value={linha.item} />
          <input type="hidden" name="categoria" value={escolhida} />
          <RadioGroup
            value={escolhida}
            onValueChange={setEscolhida}
            aria-label="Categoria"
            className="max-h-80 gap-3 overflow-y-auto sm:grid-cols-2"
          >
            {opcoes.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <RadioGroupItem value={String(o.id)} id={`cat-${linha.item}-${o.id}`} />
                <Label htmlFor={`cat-${linha.item}-${o.id}`} className="font-normal">
                  {o.nome}
                </Label>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <RadioGroupItem value={SEM_CATEGORIA} id={`cat-${linha.item}-sem`} />
              <Label htmlFor={`cat-${linha.item}-sem`} className="font-normal text-muted-foreground">
                Sem categoria
              </Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">Fica no log de auditoria com o seu usuário.</p>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <BotaoDeEnvio disabled={escolhida === atual}>Salvar</BotaoDeEnvio>
          </DialogFooter>
        </FormularioDeAcao>
      </DialogContent>
    </Dialog>
  );
}

const c = colunasDe<LinhaDeItem>();

function colunas(natureza: Natureza, opcoes: OpcaoDeCategoria[]) {
  return c.columns([
    c.accessor("item", {
      meta: { rotulo: "Item do ProDoctor" },
      header: ({ column }) => <DataTableColumnHeader column={column} titulo="Item do ProDoctor" />,
      cell: ({ row }) => (
        <span className="flex min-w-56 flex-col gap-1 whitespace-normal">
          {row.original.item}
          {row.original.foraDoPlano && (
            <Status tom="neutro" className="w-fit" title="Conta lançada direto num grupo do plano, sem item">
              Grupo, sem item
            </Status>
          )}
        </span>
      ),
    }),
    c.accessor("unidades", {
      meta: { rotulo: "Unidades" },
      header: "Unidades",
      enableSorting: false,
      cell: ({ getValue }) => <span className="block min-w-32 text-xs whitespace-normal text-muted-foreground">{getValue()}</span>,
    }),
    c.accessor("contas", {
      meta: { rotulo: "Contas", alinhar: "direita" },
      header: ({ column }) => <DataTableColumnHeader column={column} titulo="Contas" />,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue().toLocaleString("pt-BR")}</span>,
      enableGlobalFilter: false,
    }),
    c.accessor((l) => l.categoria ?? "Sem categoria", {
      id: "categoria",
      meta: { rotulo: "Categoria" },
      header: ({ column }) => <DataTableColumnHeader column={column} titulo="Categoria" />,
      cell: ({ row }) =>
        row.original.categoria === null ? <Status tom="atencao">Sem categoria</Status> : row.original.categoria,
    }),
    c.display({
      id: "trocar",
      header: "Ação",
      enableHiding: false,
      cell: ({ row }) => <TrocarCategoria linha={row.original} natureza={natureza} opcoes={opcoes} />,
    }),
  ]);
}

export function TabelaDeItens({
  linhas,
  natureza,
  opcoes,
}: {
  linhas: LinhaDeItem[];
  natureza: Natureza;
  opcoes: OpcaoDeCategoria[];
}) {
  // As colunas dependem das opções (vindas do servidor): refeitas só quando elas mudam.
  const atuais = useMemo(() => colunas(natureza, opcoes), [natureza, opcoes]);
  return (
    <DataTable
      className="mt-3"
      columns={atuais}
      data={linhas}
      getRowId={(l) => l.item}
      busca={{ placeholder: "Buscar item ou categoria…" }}
      tamanhoPagina={50}
      vazio="Nenhum item com esse texto."
    />
  );
}
