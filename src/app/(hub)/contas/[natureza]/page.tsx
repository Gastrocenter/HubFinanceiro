import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { formatarReais } from "@/dominio/formatar-reais";
import { formatarData } from "@/dominio/formatar-data";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { comFiltros, filtrosLigados, lerFiltros, type Aba, type Busca, type FiltrosDeContas } from "@/contas/filtros";
import { hojeEmSaoPaulo } from "@/contas/periodo";
import { consultarContas, type LinhaDoResumo, type Natureza } from "@/contas/consultar-contas";
import { PainelDeFiltros } from "./painel-de-filtros";
import { TabelaDeContas, type ContaDaTabela } from "./tabela-de-contas";

const ABAS: { aba: Aba; rotulo: string }[] = [
  { aba: "stella", rotulo: "Stella Central" },
  { aba: "sabin", rotulo: "Albert Sabin" },
  { aba: "todas", rotulo: "Todas" },
];

const TEXTOS: Record<Natureza, { titulo: string; efetivado: string; efetivacao: string; pessoa: string }> = {
  pagar: { titulo: "Contas a pagar", efetivado: "Pago", efetivacao: "Pagamento", pessoa: "Fornecedor" },
  receber: { titulo: "Contas a receber", efetivado: "Recebido", efetivacao: "Recebimento", pessoa: "Cliente" },
};

const ehNatureza = (v: string): v is Natureza => v === "pagar" || v === "receber";

type Categoria = { slug: string; nome: string; linha: LinhaDoResumo; itens: LinhaDoResumo[] };

/** O resumo vem em ordem do banco: a linha da categoria (item nulo) e depois as dos seus itens. */
function agrupar(resumo: LinhaDoResumo[]): Categoria[] {
  const grupos: Categoria[] = [];
  for (const l of resumo) {
    if (l.item === null) grupos.push({ slug: l.categoria_slug, nome: l.categoria, linha: l, itens: [] });
    else grupos.at(-1)?.itens.push(l);
  }
  return grupos;
}

function MenuDeCategorias({ caminho, filtros, hoje, categorias, efetivado }: {
  caminho: string; filtros: FiltrosDeContas; hoje: string; categorias: Categoria[]; efetivado: string;
}) {
  if (categorias.length === 0) return null;
  const marcadas = new Set(filtros.categorias);
  return (
    <section aria-labelledby="titulo-categorias" className="rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="titulo-categorias" className="text-sm font-semibold">Categorias</h2>
        {marcadas.size > 0 && (
          <Link href={comFiltros(caminho, filtros, { categorias: [] }, hoje)} className="text-xs text-muted-foreground underline">
            Limpar
          </Link>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {categorias.map((c) => {
          const ligada = marcadas.has(c.slug);
          const proximas = ligada ? filtros.categorias.filter((s) => s !== c.slug) : [...filtros.categorias, c.slug];
          return (
            <li key={c.slug}>
              <details>
                <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <Link
                    href={comFiltros(caminho, filtros, { categorias: proximas }, hoje)}
                    aria-pressed={ligada}
                    className={cn("flex-1 font-medium", ligada && "text-primary underline")}
                  >
                    {c.nome}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">{c.linha.contas}</span>
                </summary>
                <dl className="mt-1 mb-2 grid grid-cols-2 gap-x-4 px-2 text-xs text-muted-foreground">
                  <dt>Em aberto</dt>
                  <dd className="text-right tabular-nums">{formatarReais(c.linha.em_aberto)}</dd>
                  <dt>{efetivado}</dt>
                  <dd className="text-right tabular-nums">{formatarReais(c.linha.efetivado)}</dd>
                </dl>
                <ul className="mb-2 flex flex-col gap-0.5 border-l pl-3 ml-3 text-xs">
                  {c.itens.map((i) => (
                    <li key={i.item} className="flex justify-between gap-2">
                      <span>{i.item || "—"}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {i.contas} · {formatarReais(i.em_aberto)} / {formatarReais(i.efetivado)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function Conteudo({ params, searchParams }: { params: Promise<{ natureza: string }>; searchParams: Promise<Busca> }) {
  const { natureza } = await params;
  if (!ehNatureza(natureza)) notFound();
  await exigirAcesso("ver_contas");

  const hoje = hojeEmSaoPaulo();
  const filtros = lerFiltros(await searchParams, hoje);
  const caminho = `/contas/${natureza}`;
  const t = TEXTOS[natureza];
  const { linhas, totais, resumo } = await consultarContas(criarClienteAdmin(), natureza, filtros);
  const categorias = agrupar(resumo);

  const contas: ContaDaTabela[] = linhas.map((l) => ({
    id: String(l.id),
    entrada: l.data_inclusao ?? "",
    entradaTexto: formatarData(l.data_inclusao),
    vencimento: l.data_vencimento ?? "",
    vencimentoTexto: formatarData(l.data_vencimento),
    efetivacao: l.data_efetivacao ?? "",
    efetivacaoTexto: formatarData(l.data_efetivacao),
    numero: l.numero,
    pessoa: l.fornecedor ?? "—",
    categoria: l.categoria,
    item: l.item || "—",
    valor: l.valor,
    situacao: l.situacao === "PAGA" || l.situacao === "RECEBIDA" ? "efetivada" : l.vencida ? "vencida" : "aberta",
  }));

  const cartoes = [
    ["Em aberto", totais.em_aberto],
    ["Vencido", totais.vencido],
    [t.efetivado, totais.efetivado],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Do ProDoctor, só leitura. De {formatarData(filtros.de)} a {formatarData(filtros.ate)}, por{" "}
            {filtros.tipoDeData === "vencimento" ? "vencimento" : filtros.tipoDeData === "entrada" ? "data de entrada" : t.efetivacao.toLowerCase()}.
          </p>
        </div>
        <PainelDeFiltros
          caminho={caminho}
          filtros={filtros}
          hoje={hoje}
          ligados={filtrosLigados(filtros, hoje)}
          rotuloEfetivacao={t.efetivacao}
          rotuloEfetivada={natureza === "pagar" ? "Paga" : "Recebida"}
          rotuloPessoa={t.pessoa}
          categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))}
        />
      </div>

      <nav className="mt-6 flex gap-1 border-b" aria-label="Unidade">
        {ABAS.map(({ aba, rotulo }) => (
          <Link
            key={aba}
            href={comFiltros(caminho, filtros, { aba }, hoje)}
            aria-current={aba === filtros.aba ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm",
              aba === filtros.aba ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cartoes.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl bg-card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(valor)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <MenuDeCategorias caminho={caminho} filtros={filtros} hoje={hoje} categorias={categorias} efetivado={t.efetivado} />
        <TabelaDeContas
          contas={contas}
          caminho={caminho}
          filtros={filtros}
          hoje={hoje}
          categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))}
          rotuloEfetivacao={t.efetivacao}
          rotuloEfetivada={natureza === "pagar" ? "Paga" : "Recebida"}
          rotuloPessoa={t.pessoa}
        />
      </div>
    </div>
  );
}

export default function PaginaDeContas(props: { params: Promise<{ natureza: string }>; searchParams: Promise<Busca> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela indicadores={3} tabelas={1} largura="max-w-7xl" />}>
      <Conteudo {...props} />
    </Suspense>
  );
}
