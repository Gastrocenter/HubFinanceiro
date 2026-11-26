import { DemoBasica, DemoInterativa } from "./demo";

export const metadata = { title: "Data Table · Design system" };

const props = [
  ["columns", "ColunaDaTabela<TData>[]", "—", "Colunas do TanStack Table v9 (use colunasDe). Declare fora do render."],
  ["data", "TData[]", "—", "Linhas."],
  ["getRowId", "(linha) => string", "índice", "Id estável; mantém a seleção ao ordenar e filtrar."],
  ["busca", "{ placeholder?: string }", "undefined", "Mostra a busca em todas as colunas filtráveis."],
  ["tamanhoPagina", "number | false", "10", "Linhas por página; false desliga a paginação."],
  ["selecionavel", "boolean", "false", "Coluna de checkbox à esquerda."],
  ["aoMudarSelecao", "(linhas: TData[]) => void", "—", "Recebe as linhas selecionadas."],
  ["escolherColunas", "boolean", "false", "Menu para esconder e mostrar colunas."],
  ["densidade", '"normal" | "compacta"', '"normal"', "Altura das linhas."],
  ["carregando", "boolean", "false", "Linhas-esqueleto e aria-busy na tabela."],
  ["vazio", "ReactNode", '"Nenhum registro."', "Conteúdo sem linhas ou sem resultado na busca."],
  ["rodape", "(linhas: TData[]) => ReactNode", "—", "Linha de rodapé (o total), com as linhas filtradas."],
  ["className", "string", "—", "Classe do contêiner."],
] as const;

const codigoImport = `import { colunasDe, DataTable, DataTableColumnHeader } from "@/components/data-table";`;

const codigoBasico = `// Fora do componente: colunas são entrada estável da tabela (TanStack Table v9).
const c = colunasDe<Recebivel>();
const colunas = c.columns([
  c.accessor("id", { header: "Código" }),
  c.accessor("data", { header: "Data", cell: ({ getValue }) => formatarData(getValue()) }),
  c.accessor("convenio", { header: "Convênio" }),
]);

<DataTable columns={colunas} data={recebiveis} tamanhoPagina={false} />`;

const codigoValor = `// Valor é ValorExato (texto): nunca Number/parseFloat (ADR-0004).
c.accessor("valor", {
  meta: { rotulo: "Valor", alinhar: "direita" },
  sortFn: "valorExato",                    // registrado em recursosDaTabela; compara sem ponto flutuante
  enableGlobalFilter: false,
  header: ({ column }) => <DataTableColumnHeader column={column} titulo="Valor" />,
  cell: ({ getValue }) => formatarReais(getValue()),
})`;

const codigoCompleto = `<DataTable
  columns={colunas}
  data={recebiveis}
  getRowId={(r) => r.id}
  busca={{ placeholder: "Buscar convênio…" }}
  selecionavel
  aoMudarSelecao={setEscolhidos}
  escolherColunas
  tamanhoPagina={10}
  vazio="Nenhum recebível no período."
  rodape={(linhas) => (
    <TableRow>
      <TableCell colSpan={6}>Total</TableCell>
      {/* soma exata, arredonda só no total */}
      <TableCell className="text-right">{formatarReais(somarValores(linhas.map((l) => l.valor)))}</TableCell>
    </TableRow>
  )}
/>`;

function Codigo({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-sidebar p-4 font-mono text-xs leading-relaxed text-sidebar-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{titulo}</h2>
      {children}
    </section>
  );
}

export default function DataTablePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-10 py-12">
      <header>
        <p className="text-sm text-muted-foreground">Componentes</p>
        <h1 className="mt-1 text-5xl font-semibold tracking-tight">Data Table</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Tabela de dados com ordenação, busca, seleção, colunas visíveis e paginação. É o padrão do
          shadcn (<code className="font-mono text-sm">table</code> + TanStack Table) num componente só, com
          ordenação exata para valores em reais.
        </p>
      </header>

      <Secao titulo="Demo interativa">
        <p className="text-sm text-muted-foreground">
          Os botões ligam e desligam as props. Clique nos cabeçalhos para ordenar; o tema escuro fica no rodapé
          da barra lateral. Dados fictícios.
        </p>
        <DemoInterativa />
      </Secao>

      <Secao titulo="Importação">
        <Codigo>{codigoImport}</Codigo>
      </Secao>

      <Secao titulo="Uso básico">
        <DemoBasica />
        <Codigo>{codigoBasico}</Codigo>
      </Secao>

      <Secao titulo="Coluna de valor">
        <p className="text-sm text-muted-foreground">
          Valores chegam como texto exato. A ordenação usa <code className="font-mono">compararValores</code>{" "}
          (src/dominio/valor.ts) e o total soma antes de arredondar.
        </p>
        <Codigo>{codigoValor}</Codigo>
      </Secao>

      <Secao titulo="Exemplo completo">
        <Codigo>{codigoCompleto}</Codigo>
      </Secao>

      <Secao titulo="Props">
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 font-medium">Prop</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Padrão</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {props.map(([nome, tipo, padrao, descricao]) => (
                <tr key={nome} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">{nome}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{tipo}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{padrao}</td>
                  <td className="px-4 py-2.5">{descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Em <code className="font-mono">columnDef.meta</code>: <code className="font-mono">rotulo</code> (nome no
          menu de colunas) e <code className="font-mono">alinhar</code> (&quot;direita&quot; para valores, com
          números tabulares).
        </p>
      </Secao>

      <Secao titulo="Acessibilidade">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>Cabeçalhos ordenáveis são botões (Tab, Enter ou Espaço) e o &lt;th&gt; expõe aria-sort.</li>
          <li>Checkboxes têm rótulo (&quot;Selecionar linha&quot;, &quot;Selecionar todas as linhas da página&quot;) e o
            do cabeçalho fica indeterminado em seleção parcial.</li>
          <li>Contagem de seleção e de registros é anunciada (aria-live=&quot;polite&quot;).</li>
          <li>Paginação com aria-label nos botões de ícone; botões desabilitados nas pontas.</li>
          <li>O menu de colunas e o de ações usam o Radix DropdownMenu: setas, Esc e foco devolvido ao gatilho.</li>
          <li>Durante o carregamento, a tabela fica com aria-busy.</li>
          <li>Dê ao botão de ações de cada linha um aria-label que diga a linha (ex.: &quot;Ações de RCB-1040&quot;).</li>
        </ul>
      </Secao>
    </div>
  );
}
