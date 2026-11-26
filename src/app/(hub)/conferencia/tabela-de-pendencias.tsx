"use client";

import { useState } from "react";
import Link from "next/link";
import { BotaoDeEnvio, FormularioDeAcao } from "@/components/formulario-de-acao";
import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Status } from "@/components/status";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { resolverPendencia } from "./acoes";

/** Uma pendência já pronta para a tela: só texto e números, montados no servidor. */
export type LinhaDePendencia = {
  id: number;
  /** ISO, para ordenar. */
  criadoEm: string;
  criadoEmTexto: string;
  categoria: string;
  descricao: string;
  origem: { texto: string; link: string | null };
  resolucao:
    | { tipo: "resolver" }
    | { tipo: "automatica" }
    | { tipo: "sem-permissao" }
    | { tipo: "resolvida"; quando: string; justificativa: string | null };
};

const LIMITE = 1000;

/** Resolve à mão: mostra o que é a pendência e pede a justificativa, que vai para a auditoria. */
function ResolverPendencia({ linha }: { linha: LinhaDePendencia }) {
  const [aberto, setAberto] = useState(false);
  // Controlado: o React limpa campos não controlados depois da action, e o texto se perderia num erro.
  const [justificativa, setJustificativa] = useState("");
  const idDoCampo = `justificativa-${linha.id}`;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) setJustificativa("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Resolver a pendência: ${linha.descricao}`}>
          Resolver
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <FormularioDeAcao acao={resolverPendencia} aoConcluir={() => setAberto(false)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Resolver pendência</DialogTitle>
            <DialogDescription>
              Use quando a diferença com o ProDoctor está explicada e não precisa de correção no cadastro.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-muted p-4 text-sm">
            <dt className="text-muted-foreground">Categoria</dt>
            <dd>{linha.categoria}</dd>
            <dt className="text-muted-foreground">O que é</dt>
            <dd>{linha.descricao}</dd>
            <dt className="text-muted-foreground">Origem</dt>
            <dd>{linha.origem.texto}</dd>
            <dt className="text-muted-foreground">Desde</dt>
            <dd className="tabular-nums">{linha.criadoEmTexto}</dd>
          </dl>

          <input type="hidden" name="id" value={linha.id} />
          <Field>
            <FieldLabel htmlFor={idDoCampo}>Justificativa</FieldLabel>
            <Textarea
              id={idDoCampo}
              name="justificativa"
              required
              maxLength={LIMITE}
              rows={4}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: glosa aceita pelo convênio, conferida no extrato de maio."
              aria-describedby={`${idDoCampo}-ajuda`}
            />
            <FieldDescription id={`${idDoCampo}-ajuda`} className="flex justify-between gap-4">
              <span>Fica no log de auditoria com o seu usuário.</span>
              <span className="tabular-nums" aria-live="polite">
                {justificativa.length}/{LIMITE}
              </span>
            </FieldDescription>
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <BotaoDeEnvio disabled={justificativa.trim() === ""}>Resolver pendência</BotaoDeEnvio>
          </DialogFooter>
        </FormularioDeAcao>
      </DialogContent>
    </Dialog>
  );
}

function Resolucao({ linha }: { linha: LinhaDePendencia }) {
  const r = linha.resolucao;
  switch (r.tipo) {
    case "resolvida":
      return (
        <div className="flex flex-col gap-1 whitespace-normal">
          <span className="tabular-nums">{r.quando}</span>
          {r.justificativa ? (
            <span className="text-muted-foreground">{r.justificativa}</span>
          ) : (
            <Status tom="neutro" className="w-fit">pela sincronização</Status>
          )}
        </div>
      );
    case "automatica":
      return <span className="text-xs whitespace-normal text-muted-foreground">Fecha sozinha ao corrigir o cadastro</span>;
    case "sem-permissao":
      return <span className="text-muted-foreground">—</span>;
    case "resolver":
      return <ResolverPendencia linha={linha} />;
  }
}

const c = colunasDe<LinhaDePendencia>();

const colunas = c.columns([
  c.accessor("criadoEm", {
    meta: { rotulo: "Desde" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Desde" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.criadoEmTexto}</span>,
    enableGlobalFilter: false,
  }),
  c.accessor("categoria", {
    meta: { rotulo: "Categoria" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Categoria" />,
  }),
  c.accessor("descricao", {
    meta: { rotulo: "O que é" },
    header: "O que é",
    enableSorting: false,
    cell: ({ getValue }) => <span className="block min-w-64 whitespace-normal">{getValue()}</span>,
  }),
  c.accessor((l) => l.origem.texto, {
    id: "origem",
    meta: { rotulo: "Registro de origem" },
    header: "Registro de origem",
    enableSorting: false,
    cell: ({ row }) => {
      const { texto, link } = row.original.origem;
      return (
        <span className="block min-w-48 whitespace-normal">
          {link ? (
            <Link href={link} className="underline underline-offset-2 hover:text-foreground">
              {texto}
            </Link>
          ) : (
            texto
          )}
        </span>
      );
    },
  }),
  c.display({
    id: "resolucao",
    header: "Resolução",
    enableHiding: false,
    cell: ({ row }) => <Resolucao linha={row.original} />,
  }),
]);

export function TabelaDePendencias({ linhas }: { linhas: LinhaDePendencia[] }) {
  return (
    <DataTable
      className="mt-3"
      columns={colunas}
      data={linhas}
      getRowId={(l) => String(l.id)}
      busca={{ placeholder: "Buscar descrição, categoria ou registro…" }}
      tamanhoPagina={25}
      vazio="Nenhuma pendência com esse texto."
    />
  );
}
