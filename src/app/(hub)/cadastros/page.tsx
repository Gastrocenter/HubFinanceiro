import { Suspense } from "react";
import Link from "next/link";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { lerTudo } from "@/lib/ler-tudo";
import { carregarSugestoes, type SinaisComSugestao } from "@/cadastros/sinais";
import { valorExibido } from "@/cadastros/sugestoes-aplicaveis";
import { pedeSoAtivos } from "@/sync/fila";
import { aceitarSugestoes } from "./acoes";
import { BotaoDeEnvio, FormularioDeAcao } from "@/components/formulario-de-acao";
import { TabelaDeCadastros, type LinhaDeCadastro } from "./tabela-de-cadastros";
import { Lightbulb, ListChecks } from "lucide-react";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Vazio } from "@/components/vazio";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Cadastros e de-para</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vindos do ProDoctor. Cadastro novo fica &quot;a revisar&quot; até alguém confirmar.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Tipo de cadastro">
        {TIPOS.map((t) => (
          <Link
            key={t.valor}
            href={href(t.valor, soARevisar ? "a-revisar" : "todos")}
            aria-current={t.valor === tipo ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 ${t.valor === tipo ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {t.rotulo}
          </Link>
        ))}
        <span className="mx-2 self-center text-muted-foreground/70">|</span>
        <Link href={href(tipo, "a-revisar")} className={soARevisar ? "font-semibold underline" : "underline"}>A revisar</Link>
        <Link href={href(tipo, "todos")} className={!soARevisar ? "font-semibold underline" : "underline"}>Todos</Link>
      </nav>

      <p className="mt-4 text-sm text-muted-foreground">{linhas.length} {soARevisar ? "a revisar" : "no total"}</p>

      {comSugestao.length > 0 && (
        <FormularioDeAcao acao={aceitarSugestoes} className="mt-4">
          <Alert variant="atencao">
          <Lightbulb />
          <AlertTitle>Sugestões do Hub para {comSugestao.length} profissionais</AlertTitle>
          <AlertDescription>
          {/* O que está na tela agora: a ação aplica só isto, e só se nada mudou (code-review item 6). */}
          {comSugestao.map((l) => (
            <input key={l.id} type="hidden" name="exibida" value={valorExibido(l.id, sugestoes.get(l.id)!.sugestao!)} />
          ))}
          <p>
            {comSugestao.filter((l) => sugestoes.get(l.id)?.sugestao === "medico").length} médicos e{" "}
            {comSugestao.filter((l) => sugestoes.get(l.id)?.sugestao === "nao_medico").length} não médicos, pela especialidade
            e pelo volume de procedimentos. Confira a coluna &quot;Sugestão&quot; antes de aceitar.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="confirmo" value="sim" required className="size-4 accent-primary" />
            Conferi as sugestões e quero aplicá-las com o meu usuário
          </label>
          <BotaoDeEnvio className="mt-3 w-fit">Aceitar {comSugestao.length} sugestões</BotaoDeEnvio>
          </AlertDescription>
          </Alert>
        </FormularioDeAcao>
      )}

      {linhas.length === 0 ? (
        <Vazio
          icone={ListChecks}
          titulo={soARevisar ? "Nada a revisar" : "Nenhum cadastro"}
          descricao={soARevisar ? "Cadastro novo do ProDoctor aparece aqui na próxima sincronização." : "Ainda não veio cadastro deste tipo do ProDoctor."}
        />
      ) : (
        <TabelaDeCadastros
          key={tipo}
          profissional={tipo === "profissional"}
          linhas={linhas.map((l) => ({
            id: l.id,
            nome: l.nome_origem,
            codigo: `${l.empresa}:${l.codigo_origem}`,
            situacao: situacaoDe(l, tipo),
            sinais: sugestoes.get(l.id) ?? null,
            revisado: l.revisado_em !== null,
            medico: l.profissionais?.eh_medico ?? null,
          }))}
        />
      )}
    </div>
  );
}

/** Etiqueta da situação no ProDoctor; `null` é ativo (sem etiqueta). */
function situacaoDe(l: Linha, tipo: Tipo): LinhaDeCadastro["situacao"] {
  // O job pede só os ativos (o ProDoctor não diz o estado do usuário): fora da lista é inativo ou removido.
  if (!l.visto_na_ultima_sync && pedeSoAtivos(tipo)) return { tom: "neutro", texto: "Inativo ou removido no ProDoctor" };
  if (!l.visto_na_ultima_sync) return { tom: "erro", texto: "Sumiu do ProDoctor" };
  if (!l.ativo) return { tom: "neutro", texto: "Inativo" };
  return null;
}

export default function Cadastros({ searchParams }: { searchParams: Promise<Filtros> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela largura="max-w-4xl" />}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
