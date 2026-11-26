import { Suspense } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { classificarPendencia, type Categoria } from "@/conferencia/classificar-pendencia";
import { lerSincronizacoes } from "@/conferencia/ler-sincronizacoes";
import { formatarReais } from "@/dominio/formatar-reais";
import { temPermissao } from "@/dominio/permissoes";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { lerTudo } from "@/lib/ler-tudo";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { ROTA_REPASSES } from "@/repasse/normalizar";
import { ROTA_CONTAS } from "@/contas/normalizar";
import { TabelaDePendencias } from "./tabela-de-pendencias";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Status } from "@/components/status";
import { Vazio } from "@/components/vazio";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Integridade = {
  empresa: string;
  job_id: number;
  rota: string;
  mes: string;
  concluido_em: string;
  linhas_bruto: number;
  linhas_hub: number;
  total_bruto: string;
  total_hub: string;
  titulos_bruto: number | null;
  titulos_hub: number | null;
  bate: boolean;
};

type Pendencia = {
  id: number;
  tipo: string;
  empresa: string;
  referencia: string;
  descricao: string;
  detalhes: Record<string, unknown>;
  estado: "aberta" | "resolvida";
  criado_em: string;
  resolvido_em: string | null;
  justificativa: string | null;
};

const CATEGORIAS: Record<Categoria, string> = {
  excluido: "Excluído",
  glosa: "Glosa",
  de_para: "Sem de-para",
  repasse: "Repasse",
  outra: "Outra",
};

const RESOLVIDAS_MOSTRADAS = 200;
const SELECT_PENDENCIAS = "id, tipo, empresa, referencia, descricao, detalhes, estado, criado_em, resolvido_em, justificativa";

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nunca";
const tipoDaExportacao = (rota: string) => (rota === ROTA_REPASSES ? "Repasses" : rota === ROTA_CONTAS ? "Contas a pagar/receber" : "Receita");

async function Conteudo({ busca }: { busca: Promise<{ categoria?: string; estado?: string }> }) {
  const sessao = await exigirAcesso("ver_conferencia");
  const podeResolver = temPermissao(sessao.perfis, "resolver_pendencia");
  const { categoria, estado: estadoPedido } = await busca;
  const estado = estadoPedido === "resolvida" ? "resolvida" : "aberta";
  const db = criarClienteAdmin();
  const [integridade, status, pendencias] = await Promise.all([
    db.rpc("integridade_das_exportacoes").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return (data ?? []) as Integridade[];
    }),
    lerSincronizacoes(db, new Date()),
    estado === "aberta"
      ? lerTudo(
          (de, ate) =>
            db.from("pendencias").select(SELECT_PENDENCIAS).eq("estado", "aberta").order("criado_em", { ascending: false }).order("id").range(de, ate),
          "ler pendências abertas",
        )
      : db.from("pendencias").select(SELECT_PENDENCIAS).eq("estado", "resolvida")
          .order("resolvido_em", { ascending: false }).order("id", { ascending: false }).limit(RESOLVIDAS_MOSTRADAS)
          .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            return data ?? [];
          }),
  ]);

  const variasEmpresas = new Set(status.map((s) => s.empresa)).size > 1;
  const paradas = status.filter((s) => s.parado);
  const naoBatem = integridade.filter((i) => !i.bate);

  const classificadas = (pendencias as Pendencia[]).map((p) => ({ ...p, classificacao: classificarPendencia(p) }));
  const contagem = new Map<Categoria, number>();
  for (const p of classificadas) contagem.set(p.classificacao.categoria, (contagem.get(p.classificacao.categoria) ?? 0) + 1);
  const filtro = categoria && categoria in CATEGORIAS ? (categoria as Categoria) : null;
  const mostradas = filtro ? classificadas.filter((p) => p.classificacao.categoria === filtro) : classificadas;
  const url = (mudar: { categoria?: string | null; estado?: string }) => {
    const p = new URLSearchParams();
    const e = mudar.estado ?? estado;
    const c = mudar.categoria === undefined ? filtro : mudar.categoria;
    if (e !== "aberta") p.set("estado", e);
    if (c) p.set("categoria", c);
    const q = p.toString();
    return q ? `/conferencia?${q}` : "/conferencia";
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Conferência</h1>

      {(paradas.length > 0 || naoBatem.length > 0) && (
        <Alert variant="destructive" className="mt-4">
          <TriangleAlert />
          <AlertTitle>Os dados do Hub podem estar incompletos</AlertTitle>
          <AlertDescription>
          {paradas.length > 0 && (
            <p><strong>Sincronização parada há mais de 24 h:</strong> {paradas.map((s) => (variasEmpresas ? `${s.nome} (${s.empresa})` : s.nome)).join(", ")}.</p>
          )}
          {naoBatem.length > 0 && (
            <p className={paradas.length > 0 ? "mt-1" : ""}>
              <strong>Exportação que não bate com o ProDoctor:</strong>{" "}
              {naoBatem.map((i) => `${tipoDaExportacao(i.rota)} de ${rotuloDoMes(i.mes)}${variasEmpresas ? ` (${i.empresa})` : ""}`).join(", ")}.
            </p>
          )}
          </AlertDescription>
        </Alert>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Sincronizações</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {variasEmpresas && <TableHead>Empresa</TableHead>}
                <TableHead>Dados</TableHead>
                <TableHead>Última conclusão</TableHead>
                <TableHead className="text-right">Falhas desde então</TableHead>
                <TableHead>Último erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status.map((s) => (
                <TableRow key={`${s.empresa}:${s.rota}`} className={`${s.parado ? "bg-destructive/5" : ""}`}>
                  {variasEmpresas && <TableCell>{s.empresa}</TableCell>}
                  <TableCell>{s.nome}{s.parado && <Status tom="erro" className="ml-2">parada</Status>}</TableCell>
                  <TableCell className="tabular-nums">{dataHora(s.ultimaConclusao)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.falhas}</TableCell>
                  <TableCell className="min-w-64 text-xs whitespace-normal text-muted-foreground">{s.ultimoErro ? s.ultimoErro.slice(0, 200) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Integridade das exportações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Último job concluído de cada mês nos 119 dias (antes do expurgo do bruto), conferido contra o que veio do ProDoctor (linhas e total; nos
          repasses, também os títulos). {integridade.length - naoBatem.length} de {integridade.length} batem.
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exportação</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Linhas (ProDoctor / Hub)</TableHead>
                <TableHead className="text-right">Total (ProDoctor / Hub)</TableHead>
                <TableHead className="text-right">Títulos (ProDoctor / Hub)</TableHead>
                <TableHead>Conferido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integridade.map((i) => (
                <TableRow key={i.job_id} className={`${i.bate ? "" : "bg-destructive/5"}`}>
                  <TableCell>{tipoDaExportacao(i.rota)}</TableCell>
                  <TableCell>{rotuloDoMes(i.mes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.linhas_bruto} / {i.linhas_hub}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReais(i.total_bruto)} / {formatarReais(i.total_hub)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.titulos_bruto === null ? "—" : `${i.titulos_bruto} / ${i.titulos_hub}`}</TableCell>
                  <TableCell>{i.bate ? <Status tom="sucesso">bate</Status> : <Status tom="erro">não bate</Status>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Pendências</h2>
        <nav className="mt-2 flex flex-wrap gap-2 text-sm" aria-label="Estado">
          {(["aberta", "resolvida"] as const).map((e) => (
            <Link key={e} href={url({ estado: e, categoria: null })} aria-current={e === estado ? "page" : undefined}
              className={`rounded-lg border px-3 py-1 ${e === estado ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {e === "aberta" ? "Abertas" : `Resolvidas (últimas ${RESOLVIDAS_MOSTRADAS})`}
            </Link>
          ))}
        </nav>
        <nav className="mt-2 flex flex-wrap gap-2 text-sm" aria-label="Categoria">
          <Link href={url({ categoria: null })} aria-current={filtro === null ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 ${filtro === null ? "border-primary" : "border-border"}`}>
            Todas ({classificadas.length})
          </Link>
          {(Object.keys(CATEGORIAS) as Categoria[]).filter((c) => contagem.has(c)).map((c) => (
            <Link key={c} href={url({ categoria: c })} aria-current={filtro === c ? "page" : undefined}
              className={`rounded-lg border px-3 py-1 ${filtro === c ? "border-primary" : "border-border"}`}>
              {CATEGORIAS[c]} ({contagem.get(c)})
            </Link>
          ))}
        </nav>

        {mostradas.length === 0 ? (
          estado === "aberta" ? (
            <Vazio
              icone={CircleCheck}
              titulo={filtro ? `Nenhuma pendência aberta de ${CATEGORIAS[filtro].toLowerCase()}` : "Nenhuma pendência aberta"}
              descricao="O que o Hub não conseguir conciliar com o ProDoctor aparece aqui."
            />
          ) : (
            <Vazio titulo="Nenhuma pendência resolvida" descricao="As pendências resolvidas, à mão ou pela sincronização, ficam listadas aqui." />
          )
        ) : (
          <TabelaDePendencias
            linhas={mostradas.map((p) => ({
              id: p.id,
              criadoEm: p.criado_em,
              criadoEmTexto: dataHora(p.criado_em),
              categoria: CATEGORIAS[p.classificacao.categoria],
              descricao: p.descricao,
              origem: p.classificacao.origem,
              resolucao:
                estado === "resolvida"
                  ? { tipo: "resolvida", quando: dataHora(p.resolvido_em), justificativa: p.justificativa }
                  : !p.classificacao.resolveAMao
                    ? { tipo: "automatica" }
                    : podeResolver
                      ? { tipo: "resolver" }
                      : { tipo: "sem-permissao" },
            }))}
          />
        )}
      </section>
    </div>
  );
}

export default function Conferencia({ searchParams }: { searchParams: Promise<{ categoria?: string; estado?: string }> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela tabelas={3} largura="max-w-6xl" />}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
