import { Suspense } from "react";
import Link from "next/link";
import { Tags, TriangleAlert } from "lucide-react";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { lerTudo } from "@/lib/ler-tudo";
import { lerNatureza, montarItens, NATUREZAS, type CategoriaDaLista, type ItemDoBanco, type Natureza } from "@/contas/categorias";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Vazio } from "@/components/vazio";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListaDeCategorias } from "./lista-de-categorias";
import { TabelaDeItens } from "./tabela-de-itens";

type Filtros = { natureza?: string };

async function Conteudo({ busca }: { busca: Promise<Filtros> }) {
  // Editar categorias segue a permissão de cadastros: só admin e financeiro (D-11).
  await exigirAcesso("revisar_cadastros");
  const natureza: Natureza = lerNatureza((await busca).natureza);

  const db = criarClienteAdmin();
  const [itens, categorias] = await Promise.all([
    lerTudo<ItemDoBanco>(
      (de, ate) => db.rpc("itens_para_categorizar").eq("natureza", natureza).order("item").range(de, ate),
      "ler itens do plano",
    ),
    lerTudo<CategoriaDaLista>(
      (de, ate) =>
        db.from("categorias").select("id, natureza, nome, ordem").eq("natureza", natureza).order("ordem").order("id").range(de, ate),
      "ler categorias",
    ),
  ]);
  const { linhas, resumo } = montarItens(itens, categorias);
  const usoPorCategoria = new Map<number, number>();
  for (const l of linhas) if (l.categoriaId !== null) usoPorCategoria.set(l.categoriaId, (usoPorCategoria.get(l.categoriaId) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Categorias</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada item do plano financeiro do ProDoctor, sem o sufixo da unidade, cai numa categoria do Hub. É a categoria que
        aparece nas contas a pagar e a receber.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Lista de categorias">
        {NATUREZAS.map((n) => (
          <Link
            key={n.valor}
            href={`/cadastros/categorias?natureza=${n.valor}`}
            aria-current={n.valor === natureza ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 ${n.valor === natureza ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {n.rotulo}
          </Link>
        ))}
      </nav>

      {resumo.semCategoria > 0 && (
        <Alert variant="atencao" className="mt-4">
          <TriangleAlert />
          <AlertTitle>
            {resumo.semCategoria} {resumo.semCategoria === 1 ? "item sem categoria" : "itens sem categoria"}
          </AlertTitle>
          <AlertDescription>
            {resumo.contasSemCategoria.toLocaleString("pt-BR")} contas aparecem como &quot;Sem categoria&quot;. Os itens
            estão no topo da tabela.
          </AlertDescription>
        </Alert>
      )}

      <ListaDeCategorias
        natureza={natureza}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, itens: usoPorCategoria.get(c.id) ?? 0 }))}
      />

      <h2 className="mt-8 text-base font-semibold">Itens do plano</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {resumo.itens} itens. A natureza é a do código do plano: conta a receber lançada num item de despesa usa a
        categoria da despesa.
      </p>
      {linhas.length === 0 ? (
        <Vazio icone={Tags} titulo="Nenhum item" descricao="O plano financeiro chega do ProDoctor na próxima sincronização." />
      ) : (
        <TabelaDeItens
          key={natureza}
          linhas={linhas}
          natureza={natureza}
          opcoes={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
        />
      )}
    </div>
  );
}

export default function Categorias({ searchParams }: { searchParams: Promise<Filtros> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela largura="max-w-5xl" />}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
