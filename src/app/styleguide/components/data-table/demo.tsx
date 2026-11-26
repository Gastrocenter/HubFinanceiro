"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Status, type Tom } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatarData } from "@/dominio/formatar-data";
import { formatarReais } from "@/dominio/formatar-reais";
import { somarValores, type ValorExato } from "@/dominio/valor";

type Situacao = "conferido" | "pendente" | "divergente";

interface Recebivel {
  id: string;
  data: string;
  convenio: string;
  procedimento: string;
  profissional: string;
  valor: ValorExato;
  situacao: Situacao;
}

// Fixture fictícia: nenhum dado real de paciente ou profissional.
const convenios = ["Unimed", "Bradesco Saúde", "Particular", "Amil", "SulAmérica"];
const procedimentos = ["Endoscopia digestiva", "Colonoscopia", "Consulta", "Retossigmoidoscopia", "Biópsia"];
const valores: ValorExato[] = ["850.00", "1320.50", "280", "640.75", "195.333", "1890.10", "412.005", "75.5"];
const situacoes: Situacao[] = ["conferido", "conferido", "pendente", "divergente", "conferido", "pendente"];

const recebiveis: Recebivel[] = Array.from({ length: 23 }, (_, i) => ({
  id: `RCB-${String(1040 + i)}`,
  data: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
  convenio: convenios[i % convenios.length],
  procedimento: procedimentos[(i * 3) % procedimentos.length],
  profissional: `Médico ${String.fromCharCode(65 + (i % 6))}`,
  valor: valores[(i * 5) % valores.length],
  situacao: situacoes[i % situacoes.length],
}));

const tomDaSituacao: Record<Situacao, Tom> = {
  conferido: "sucesso",
  pendente: "atencao",
  divergente: "erro",
};

const rotuloSituacao: Record<Situacao, string> = {
  conferido: "Conferido",
  pendente: "Pendente",
  divergente: "Divergente",
};

const c = colunasDe<Recebivel>();

const colunas = c.columns([
  c.accessor("id", {
    meta: { rotulo: "Código" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Código" />,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
  }),
  c.accessor("data", {
    meta: { rotulo: "Data" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Data" />,
    cell: ({ getValue }) => formatarData(getValue()),
  }),
  c.accessor("convenio", {
    meta: { rotulo: "Convênio" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Convênio" />,
  }),
  c.accessor("procedimento", {
    meta: { rotulo: "Procedimento" },
    header: "Procedimento",
    enableSorting: false,
  }),
  c.accessor("profissional", {
    meta: { rotulo: "Profissional" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Profissional" />,
  }),
  c.accessor("situacao", {
    meta: { rotulo: "Situação" },
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Situação" />,
    cell: ({ getValue }) => {
      const s = getValue();
      return <Status tom={tomDaSituacao[s]}>{rotuloSituacao[s]}</Status>;
    },
  }),
  c.accessor("valor", {
    meta: { rotulo: "Valor", alinhar: "direita" },
    sortFn: "valorExato",
    enableGlobalFilter: false,
    header: ({ column }) => <DataTableColumnHeader column={column} titulo="Valor" />,
    cell: ({ getValue }) => <span className="font-medium">{formatarReais(getValue())}</span>,
  }),
  c.display({
    id: "acoes",
    enableHiding: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${row.original.id}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
          <DropdownMenuItem>Marcar como conferido</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Abrir pendência</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
]);

const colunasBasicas = colunas.slice(0, 3);
const recebiveisBasicos = recebiveis.slice(0, 4);

function Rodape(linhas: Recebivel[], selecionavel: boolean) {
  return (
    <TableRow>
      <TableCell colSpan={selecionavel ? 7 : 6} className="px-4 font-medium">
        Total ({linhas.length})
      </TableCell>
      <TableCell className="px-4 text-right font-semibold tabular-nums">
        {formatarReais(somarValores(linhas.map((l) => l.valor)))}
      </TableCell>
      <TableCell />
    </TableRow>
  );
}

function Alternar({ rotulo, ligado, onChange }: { rotulo: string; ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button
      variant={ligado ? "default" : "outline"}
      size="sm"
      aria-pressed={ligado}
      onClick={() => onChange(!ligado)}
      className="rounded-full"
    >
      {rotulo}
    </Button>
  );
}

/** Demo interativa com controles de props. */
export function DemoInterativa() {
  const [selecionavel, setSelecionavel] = useState(true);
  const [busca, setBusca] = useState(true);
  const [escolherColunas, setEscolherColunas] = useState(true);
  const [compacta, setCompacta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [semDados, setSemDados] = useState(false);
  const [comRodape, setComRodape] = useState(true);
  const [tamanho, setTamanho] = useState<5 | 10 | false>(5);
  const [escolhidos, setEscolhidos] = useState<Recebivel[]>([]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-3" role="group" aria-label="Controles da demo">
        <Alternar rotulo="selecionavel" ligado={selecionavel} onChange={setSelecionavel} />
        <Alternar rotulo="busca" ligado={busca} onChange={setBusca} />
        <Alternar rotulo="escolherColunas" ligado={escolherColunas} onChange={setEscolherColunas} />
        <Alternar rotulo="rodape" ligado={comRodape} onChange={setComRodape} />
        <Alternar rotulo='densidade="compacta"' ligado={compacta} onChange={setCompacta} />
        <Alternar rotulo="carregando" ligado={carregando} onChange={setCarregando} />
        <Alternar rotulo="data=[]" ligado={semDados} onChange={setSemDados} />
        <span className="ml-2 text-sm text-muted-foreground">tamanhoPagina:</span>
        {([5, 10, false] as const).map((t) => (
          <Alternar key={String(t)} rotulo={String(t)} ligado={tamanho === t} onChange={() => setTamanho(t)} />
        ))}
      </div>

      <DataTable
        // Remonta ao trocar a paginação: o tamanho da página é estado inicial da tabela.
        key={String(tamanho)}
        columns={colunas}
        data={semDados ? [] : recebiveis}
        getRowId={(r) => r.id}
        busca={busca ? { placeholder: "Buscar convênio, procedimento…" } : undefined}
        tamanhoPagina={tamanho}
        selecionavel={selecionavel}
        aoMudarSelecao={setEscolhidos}
        escolherColunas={escolherColunas}
        densidade={compacta ? "compacta" : "normal"}
        carregando={carregando}
        vazio="Nenhum recebível no período."
        rodape={comRodape ? (linhas) => Rodape(linhas, selecionavel) : undefined}
      />

      {selecionavel && escolhidos.length > 0 && (
        <p className="text-sm text-muted-foreground">
          aoMudarSelecao: {escolhidos.map((r) => r.id).join(", ")} ·{" "}
          {formatarReais(somarValores(escolhidos.map((r) => r.valor)))}
        </p>
      )}
    </div>
  );
}

/** Exemplo mínimo, igual ao trecho "Uso básico". */
export function DemoBasica() {
  return <DataTable columns={colunasBasicas} data={recebiveisBasicos} tamanhoPagina={false} />;
}
