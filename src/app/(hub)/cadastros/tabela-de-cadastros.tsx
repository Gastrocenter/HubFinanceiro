"use client";

import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Status, type Tom } from "@/components/status";
import { BotaoDeEnvio, FormularioDeAcao } from "@/components/formulario-de-acao";
import type { SinaisComSugestao } from "@/cadastros/sinais";
import { revisarCadastro } from "./acoes";

/** Uma linha do de-para pronta para a tela; a situação já vem decidida do servidor. */
export type LinhaDeCadastro = {
  id: number;
  nome: string;
  codigo: string;
  /** `null` é ativo e visto na última sincronização (sem etiqueta). */
  situacao: { tom: Tom; texto: string } | null;
  sinais: SinaisComSugestao | null;
  revisado: boolean;
  medico: boolean | null;
};

function Sinais({ sinais }: { sinais: SinaisComSugestao | null }) {
  if (!sinais) return <span className="text-muted-foreground/70">—</span>;
  const rotulo = sinais.sugestao === "medico" ? "Médico" : sinais.sugestao === "nao_medico" ? "Não é médico" : "Revisar";
  const tom: Tom = sinais.sugestao === "medico" ? "info" : sinais.sugestao === "nao_medico" ? "neutro" : "atencao";
  return (
    <div className="flex min-w-56 flex-col gap-1 text-xs whitespace-normal">
      <Status tom={tom} className="w-fit">{rotulo}</Status>
      <p className="text-muted-foreground">{sinais.motivo}</p>
      <p className="text-muted-foreground">
        {sinais.procedimentos} procedimentos em {sinais.meses} meses
      </p>
    </div>
  );
}

function RevisaoDeProfissional({ linha }: { linha: LinhaDeCadastro }) {
  return (
    <FormularioDeAcao acao={revisarCadastro} className="flex items-center gap-2">
      <input type="hidden" name="id" value={linha.id} />
      {linha.revisado && (
        <span className="text-xs text-muted-foreground">{linha.medico ? "Médico" : "Não é médico"}</span>
      )}
      <BotaoDeEnvio
        name="medico"
        value="sim"
        size="sm"
        variant={linha.revisado && linha.medico === true ? "default" : "outline"}
        aria-pressed={linha.revisado && linha.medico === true}
      >
        É médico
      </BotaoDeEnvio>
      <BotaoDeEnvio
        name="medico"
        value="nao"
        size="sm"
        variant={linha.revisado && linha.medico === false ? "default" : "outline"}
        aria-pressed={linha.revisado && linha.medico === false}
      >
        Não é médico
      </BotaoDeEnvio>
    </FormularioDeAcao>
  );
}

function RevisaoSimples({ linha }: { linha: LinhaDeCadastro }) {
  if (linha.revisado) return <Status tom="sucesso">Confirmado</Status>;
  return (
    <FormularioDeAcao acao={revisarCadastro}>
      <input type="hidden" name="id" value={linha.id} />
      <BotaoDeEnvio size="sm" variant="outline">
        Confirmar
      </BotaoDeEnvio>
    </FormularioDeAcao>
  );
}

const c = colunasDe<LinhaDeCadastro>();

const nome = c.accessor("nome", {
  meta: { rotulo: "Nome" },
  header: ({ column }) => <DataTableColumnHeader column={column} titulo="Nome" />,
  cell: ({ getValue }) => <span className="block min-w-48 whitespace-normal">{getValue()}</span>,
});
const codigo = c.accessor("codigo", {
  meta: { rotulo: "Código" },
  header: "Código",
  enableSorting: false,
  cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue()}</span>,
});
const situacao = c.accessor((l) => l.situacao?.texto ?? "Ativo", {
  id: "situacao",
  meta: { rotulo: "Situação" },
  header: ({ column }) => <DataTableColumnHeader column={column} titulo="Situação" />,
  cell: ({ row }) => {
    const s = row.original.situacao;
    return s ? <Status tom={s.tom}>{s.texto}</Status> : <span className="text-xs text-muted-foreground">Ativo</span>;
  },
});

const colunasDeProfissional = c.columns([
  nome,
  codigo,
  situacao,
  c.accessor((l) => (l.sinais ? `${l.sinais.motivo} ${l.sinais.especialidades.join(" ")}` : ""), {
    id: "sugestao",
    meta: { rotulo: "Sugestão" },
    header: "Sugestão",
    enableSorting: false,
    cell: ({ row }) => <Sinais sinais={row.original.sinais} />,
  }),
  c.display({ id: "revisao", header: "Revisão", enableHiding: false, cell: ({ row }) => <RevisaoDeProfissional linha={row.original} /> }),
]);

const colunasSimples = c.columns([
  nome,
  codigo,
  situacao,
  c.display({ id: "revisao", header: "Revisão", enableHiding: false, cell: ({ row }) => <RevisaoSimples linha={row.original} /> }),
]);

export function TabelaDeCadastros({ linhas, profissional }: { linhas: LinhaDeCadastro[]; profissional: boolean }) {
  return (
    <DataTable
      className="mt-3"
      columns={profissional ? colunasDeProfissional : colunasSimples}
      data={linhas}
      getRowId={(l) => String(l.id)}
      busca={{ placeholder: "Buscar nome, código ou especialidade…" }}
      tamanhoPagina={25}
      vazio="Nenhum cadastro com esse texto."
    />
  );
}
