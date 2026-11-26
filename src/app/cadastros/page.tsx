import { Suspense } from "react";
import Link from "next/link";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { lerTudo } from "@/lib/ler-tudo";
import { carregarSugestoes, type SinaisComSugestao } from "@/cadastros/sinais";
import { aceitarSugestoes, revisarCadastro } from "./acoes";

const TIPOS = [
  { valor: "profissional", rotulo: "Profissionais" },
  { valor: "convenio", rotulo: "Convênios" },
  { valor: "unidade", rotulo: "Unidades" },
] as const;
type Tipo = (typeof TIPOS)[number]["valor"];

type Linha = {
  id: number;
  empresa: string;
  codigo_origem: string;
  nome_origem: string;
  ativo: boolean;
  visto_na_ultima_sync: boolean;
  revisado_em: string | null;
  profissionais: { eh_medico: boolean | null } | null;
};

type Filtros = { tipo?: string; filtro?: string };

function href(tipo: Tipo, filtro: string) {
  return `/cadastros?tipo=${tipo}&filtro=${filtro}`;
}

async function Conteudo({ busca }: { busca: Promise<Filtros> }) {
  await exigirAcesso("revisar_cadastros");
  const filtros = await busca;
  const tipo: Tipo = TIPOS.some((t) => t.valor === filtros.tipo) ? (filtros.tipo as Tipo) : "profissional";
  const soARevisar = filtros.filtro !== "todos";

  const db = criarClienteAdmin();
  const linhas = await lerTudo<Linha>((de, ate) => {
    let consulta = db
      .from("de_para")
      .select("id, empresa, codigo_origem, nome_origem, ativo, visto_na_ultima_sync, revisado_em, profissionais(eh_medico)")
      .eq("tipo", tipo)
      .order("nome_origem")
      .order("id");
    if (soARevisar) consulta = consulta.is("revisado_em", null);
    return consulta.range(de, ate).returns<Linha[]>();
  }, "ler cadastros");
  const sugestoes = tipo === "profissional" ? await carregarSugestoes(db) : new Map<number, SinaisComSugestao>();
  const comSugestao = linhas.filter((l) => l.revisado_em === null && sugestoes.get(l.id)?.sugestao);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/painel" className="text-sm underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold">Cadastros e de-para</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Vindos do ProDoctor. Cadastro novo fica &quot;a revisar&quot; até alguém confirmar.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Tipo de cadastro">
        {TIPOS.map((t) => (
          <Link
            key={t.valor}
            href={href(t.valor, soARevisar ? "a-revisar" : "todos")}
            aria-current={t.valor === tipo ? "page" : undefined}
            className={`rounded border px-3 py-1 ${t.valor === tipo ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
          >
            {t.rotulo}
          </Link>
        ))}
        <span className="mx-2 self-center text-neutral-400">|</span>
        <Link href={href(tipo, "a-revisar")} className={soARevisar ? "font-semibold underline" : "underline"}>A revisar</Link>
        <Link href={href(tipo, "todos")} className={!soARevisar ? "font-semibold underline" : "underline"}>Todos</Link>
      </nav>

      <p className="mt-4 text-sm text-neutral-600">{linhas.length} {soARevisar ? "a revisar" : "no total"}</p>

      {comSugestao.length > 0 && (
        <form action={aceitarSugestoes} className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p>
            O Hub tem sugestão para <strong>{comSugestao.length}</strong> profissionais a revisar
            ({comSugestao.filter((l) => sugestoes.get(l.id)?.sugestao === "medico").length} médicos,{" "}
            {comSugestao.filter((l) => sugestoes.get(l.id)?.sugestao === "nao_medico").length} não médicos), pela especialidade
            e pelo volume de procedimentos. Confira a coluna &quot;Sugestão&quot; antes de aceitar.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="confirmo" value="sim" required />
            Conferi as sugestões e quero aplicá-las com o meu usuário
          </label>
          <button className="mt-3 rounded bg-neutral-900 px-3 py-1.5 text-white">Aceitar {comSugestao.length} sugestões</button>
        </form>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-2 pr-4">Nome</th>
              <th className="pr-4">Código</th>
              <th className="pr-4">Situação</th>
              {tipo === "profissional" && <th className="pr-4">Sugestão</th>}
              <th className="pr-4">Revisão</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-neutral-200 align-middle">
                <td className="py-2 pr-4">{l.nome_origem}</td>
                <td className="pr-4 font-mono text-xs text-neutral-600">{l.empresa}:{l.codigo_origem}</td>
                <td className="pr-4">
                  {!l.visto_na_ultima_sync ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Sumiu do ProDoctor</span>
                  ) : !l.ativo ? (
                    <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">Inativo</span>
                  ) : (
                    <span className="text-xs text-neutral-500">Ativo</span>
                  )}
                </td>
                {tipo === "profissional" && (
                  <td className="pr-4 text-xs">
                    <Sinais sinais={sugestoes.get(l.id)} />
                  </td>
                )}
                <td className="pr-4">
                  <Revisao linha={l} tipo={tipo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Sinais({ sinais }: { sinais?: SinaisComSugestao }) {
  if (!sinais) return <span className="text-neutral-400">—</span>;
  const rotulo = sinais.sugestao === "medico" ? "Médico" : sinais.sugestao === "nao_medico" ? "Não é médico" : "Revisar";
  const cor = sinais.sugestao === "medico" ? "bg-green-100 text-green-900" : sinais.sugestao === "nao_medico" ? "bg-neutral-200" : "bg-amber-100 text-amber-900";
  return (
    <div>
      <span className={`rounded px-1.5 py-0.5 ${cor}`}>{rotulo}</span>
      <p className="mt-1 text-neutral-600">{sinais.motivo}</p>
      <p className="text-neutral-500">{sinais.procedimentos} procedimentos em {sinais.meses} meses</p>
    </div>
  );
}

function Revisao({ linha, tipo }: { linha: Linha; tipo: Tipo }) {
  const medico = linha.profissionais?.eh_medico;
  const revisado = linha.revisado_em !== null;
  const botao = "rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100";

  if (tipo === "profissional") {
    return (
      <form action={revisarCadastro} className="flex items-center gap-2">
        <input type="hidden" name="id" value={linha.id} />
        {revisado && <span className="text-xs text-neutral-600">{medico ? "Médico" : "Não é médico"}</span>}
        <button name="medico" value="sim" className={botao} aria-pressed={revisado && medico === true}>É médico</button>
        <button name="medico" value="nao" className={botao} aria-pressed={revisado && medico === false}>Não é médico</button>
      </form>
    );
  }
  if (revisado) return <span className="text-xs text-neutral-600">Confirmado</span>;
  return (
    <form action={revisarCadastro}>
      <input type="hidden" name="id" value={linha.id} />
      <button className={botao}>Confirmar</button>
    </form>
  );
}

export default function Cadastros({ searchParams }: { searchParams: Promise<Filtros> }) {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
