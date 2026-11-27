import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { menuPara } from "@/dominio/menu";
import { temPermissao } from "@/dominio/permissoes";
import { exigirAcesso } from "@/lib/sessao";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GraficoCarregando, GraficoDeReceita } from "./grafico-de-receita";
import {
  IndicadorCarregando,
  IndicadorDePendencias,
  IndicadorDeReceita,
  IndicadorDeRepasse,
  IndicadorDeSincronizacoes,
} from "./indicadores";

/** O que cada tela responde, para o atalho do painel. */
const DESCRICOES: Record<string, string> = {
  "/receita": "Procedimentos do ProDoctor por competência, bruto, glosa e líquido.",
  "/repasses": "Quanto cada profissional recebe no mês.",
  "/contas/pagar": "Despesas por categoria, com filtro por dia, unidade e situação.",
  "/contas/receber": "Receitas por categoria, com filtro por dia, unidade e situação.",
  "/conferencia": "Pendências, sincronizações e integridade das exportações.",
  "/cadastros": "Profissionais, convênios e de-para vindos do ProDoctor.",
  "/admin/auditoria": "Quem fez o quê no Hub.",
};

/** Cada indicador carrega sozinho: um número lento não segura os outros. */
function ComCarregamento({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<IndicadorCarregando />}>{children}</Suspense>;
}

async function Conteudo() {
  const sessao = await exigirAcesso("acessar_painel");
  const pode = (acao: Parameters<typeof temPermissao>[1]) => temPermissao(sessao.perfis, acao);
  const atalhos = menuPara(sessao.perfis).flatMap((s) => s.itens).filter((i) => i.href !== "/painel");

  // Só aparece o número de quem pode abrir a tela dele; a própria tela confere o acesso de novo.
  const indicadores = [
    pode("ver_receita") && <ComCarregamento key="receita"><IndicadorDeReceita /></ComCarregamento>,
    pode("ver_repasse") && <ComCarregamento key="repasse"><IndicadorDeRepasse /></ComCarregamento>,
    pode("ver_conferencia") && <ComCarregamento key="pendencias"><IndicadorDePendencias /></ComCarregamento>,
    pode("ver_conferencia") && <ComCarregamento key="sincronizacoes"><IndicadorDeSincronizacoes /></ComCarregamento>,
  ].filter(Boolean);

  return (
    <>
      {indicadores.length > 0 && (
        <section aria-label="Indicadores" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {indicadores}
        </section>
      )}

      {pode("ver_receita") && (
        <Suspense fallback={<GraficoCarregando />}>
          <GraficoDeReceita />
        </Suspense>
      )}

      {atalhos.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Seu perfil ainda não tem telas do financeiro.</p>
      ) : (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Telas</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {atalhos.map((a) => (
              <Link key={a.href} href={a.href} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <Card className="h-full transition-colors group-hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {a.rotulo}
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </CardTitle>
                    <CardDescription>{DESCRICOES[a.href]}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function Painel() {
  return (
    <div className="mx-auto w-full max-w-6xl p-8 pt-4">
      <h1 className="text-4xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-2 text-muted-foreground">Como está o financeiro hoje.</p>
      <Suspense
        fallback={
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="min-h-36 rounded-3xl" />
            ))}
          </div>
        }
      >
        <Conteudo />
      </Suspense>
    </div>
  );
}
