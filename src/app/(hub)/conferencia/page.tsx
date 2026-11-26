import { Suspense } from "react";
import Link from "next/link";
import { classificarPendencia, type Categoria } from "@/conferencia/classificar-pendencia";
import { ROTAS_DO_AGENDAMENTO, statusDasSincronizacoes, type JobDaFila } from "@/conferencia/status-das-sincronizacoes";
import { formatarReais } from "@/dominio/formatar-reais";
import { temPermissao } from "@/dominio/permissoes";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { lerTudo } from "@/lib/ler-tudo";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { ROTA_REPASSES } from "@/repasse/normalizar";
import { ROTA_CONTAS } from "@/contas/normalizar";
import { empresasConfiguradas } from "@/sync/empresas";
import { resolverPendencia } from "./acoes";

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

/** Jobs lidos para o status das sincronizações: o bastante para ver uma parada longa. */
const DIAS_DE_FILA = 30;
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
  const agora = new Date();
  const desde = new Date(agora.getTime() - DIAS_DE_FILA * 24 * 60 * 60 * 1000).toISOString();

  const [integridade, jobs, pendencias] = await Promise.all([
    db.rpc("integridade_das_exportacoes").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return (data ?? []) as Integridade[];
    }),
    lerTudo(
      (de, ate) =>
        db.from("sync_jobs").select("empresa, rota, estado, concluido_em, atualizado_em, ultimo_erro").gte("atualizado_em", desde).order("id").range(de, ate),
      "ler a fila",
    ),
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

  type LinhaDaFila = { empresa: string; rota: string; estado: JobDaFila["estado"]; concluido_em: string | null; atualizado_em: string; ultimo_erro: string | null };
  const status = statusDasSincronizacoes(
    (jobs as LinhaDaFila[]).map((j) => ({
      empresa: j.empresa,
      rota: j.rota,
      estado: j.estado,
      concluidoEm: j.concluido_em,
      atualizadoEm: j.atualizado_em,
      ultimoErro: j.ultimo_erro,
    })),
    agora,
    { empresas: empresasConfiguradas(process.env), rotas: ROTAS_DO_AGENDAMENTO },
  );
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
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/painel" className="text-sm underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold">Conferência</h1>

      {(paradas.length > 0 || naoBatem.length > 0) && (
        <div role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {paradas.length > 0 && (
            <p><strong>Sincronização parada há mais de 24 h:</strong> {paradas.map((s) => (variasEmpresas ? `${s.nome} (${s.empresa})` : s.nome)).join(", ")}.</p>
          )}
          {naoBatem.length > 0 && (
            <p className={paradas.length > 0 ? "mt-1" : ""}>
              <strong>Exportação que não bate com o ProDoctor:</strong>{" "}
              {naoBatem.map((i) => `${tipoDaExportacao(i.rota)} de ${rotuloDoMes(i.mes)}${variasEmpresas ? ` (${i.empresa})` : ""}`).join(", ")}.
            </p>
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Sincronizações</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-300">
                {variasEmpresas && <th className="py-2 pr-4">Empresa</th>}
                <th className="py-2 pr-4">Dados</th>
                <th className="pr-4">Última conclusão</th>
                <th className="pr-4 text-right">Falhas desde então</th>
                <th className="pr-4">Último erro</th>
              </tr>
            </thead>
            <tbody>
              {status.map((s) => (
                <tr key={`${s.empresa}:${s.rota}`} className={`border-b border-neutral-200 ${s.parado ? "bg-red-50 text-red-900" : ""}`}>
                  {variasEmpresas && <td className="py-2 pr-4">{s.empresa}</td>}
                  <td className="py-2 pr-4">{s.nome}{s.parado && <span className="ml-2 text-xs font-semibold">parada</span>}</td>
                  <td className="pr-4 tabular-nums">{dataHora(s.ultimaConclusao)}</td>
                  <td className="pr-4 text-right tabular-nums">{s.falhas}</td>
                  <td className="pr-4 text-xs text-neutral-700">{s.ultimoErro ? s.ultimoErro.slice(0, 200) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Integridade das exportações</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Último job concluído de cada mês nos 119 dias (antes do expurgo do bruto), conferido contra o que veio do ProDoctor (linhas e total; nos
          repasses, também os títulos). {integridade.length - naoBatem.length} de {integridade.length} batem.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-300">
                <th className="py-2 pr-4">Exportação</th>
                <th className="pr-4">Mês</th>
                <th className="pr-4 text-right">Linhas (ProDoctor / Hub)</th>
                <th className="pr-4 text-right">Total (ProDoctor / Hub)</th>
                <th className="pr-4 text-right">Títulos (ProDoctor / Hub)</th>
                <th className="pr-4">Conferido</th>
              </tr>
            </thead>
            <tbody>
              {integridade.map((i) => (
                <tr key={i.job_id} className={`border-b border-neutral-200 ${i.bate ? "" : "bg-red-50 text-red-900"}`}>
                  <td className="py-2 pr-4">{tipoDaExportacao(i.rota)}</td>
                  <td className="pr-4">{rotuloDoMes(i.mes)}</td>
                  <td className="pr-4 text-right tabular-nums">{i.linhas_bruto} / {i.linhas_hub}</td>
                  <td className="pr-4 text-right tabular-nums">{formatarReais(i.total_bruto)} / {formatarReais(i.total_hub)}</td>
                  <td className="pr-4 text-right tabular-nums">{i.titulos_bruto === null ? "—" : `${i.titulos_bruto} / ${i.titulos_hub}`}</td>
                  <td className="pr-4">{i.bate ? "bate" : <strong>não bate</strong>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Pendências</h2>
        <nav className="mt-2 flex flex-wrap gap-2 text-sm" aria-label="Estado">
          {(["aberta", "resolvida"] as const).map((e) => (
            <Link key={e} href={url({ estado: e, categoria: null })} aria-current={e === estado ? "page" : undefined}
              className={`rounded border px-3 py-1 ${e === estado ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}>
              {e === "aberta" ? "Abertas" : `Resolvidas (últimas ${RESOLVIDAS_MOSTRADAS})`}
            </Link>
          ))}
        </nav>
        <nav className="mt-2 flex flex-wrap gap-2 text-sm" aria-label="Categoria">
          <Link href={url({ categoria: null })} aria-current={filtro === null ? "page" : undefined}
            className={`rounded border px-3 py-1 ${filtro === null ? "border-neutral-900" : "border-neutral-300"}`}>
            Todas ({classificadas.length})
          </Link>
          {(Object.keys(CATEGORIAS) as Categoria[]).filter((c) => contagem.has(c)).map((c) => (
            <Link key={c} href={url({ categoria: c })} aria-current={filtro === c ? "page" : undefined}
              className={`rounded border px-3 py-1 ${filtro === c ? "border-neutral-900" : "border-neutral-300"}`}>
              {CATEGORIAS[c]} ({contagem.get(c)})
            </Link>
          ))}
        </nav>

        {mostradas.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">{estado === "aberta" ? "Nenhuma pendência aberta." : "Nenhuma pendência resolvida."}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="py-2 pr-4">Desde</th>
                  <th className="pr-4">Categoria</th>
                  <th className="pr-4">O que é</th>
                  <th className="pr-4">Registro de origem</th>
                  <th className="pr-4">{estado === "aberta" ? "Resolver" : "Resolvida"}</th>
                </tr>
              </thead>
              <tbody>
                {mostradas.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-200 align-top">
                    <td className="py-2 pr-4 tabular-nums">{dataHora(p.criado_em)}</td>
                    <td className="pr-4">{CATEGORIAS[p.classificacao.categoria]}</td>
                    <td className="pr-4">{p.descricao}</td>
                    <td className="pr-4">
                      {p.classificacao.origem.link ? <Link href={p.classificacao.origem.link} className="underline">{p.classificacao.origem.texto}</Link> : p.classificacao.origem.texto}
                    </td>
                    <td className="pr-4">
                      {estado === "resolvida" ? (
                        <span>{dataHora(p.resolvido_em)}{p.justificativa ? ` · ${p.justificativa}` : " · pela sincronização"}</span>
                      ) : !p.classificacao.resolveAMao ? (
                        <span className="text-xs text-neutral-600">Fecha sozinha ao corrigir o cadastro</span>
                      ) : podeResolver ? (
                        <form action={resolverPendencia} className="flex gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <input name="justificativa" required maxLength={1000} placeholder="Justificativa"
                            aria-label={`Justificativa para resolver a pendência ${p.id}`} className="w-48 rounded border border-neutral-300 px-2 py-1" />
                          <button type="submit" className="rounded border border-neutral-900 px-2 py-1">Resolver</button>
                        </form>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function Conferencia({ searchParams }: { searchParams: Promise<{ categoria?: string; estado?: string }> }) {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
