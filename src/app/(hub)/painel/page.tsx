import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { menuPara } from "@/dominio/menu";
import { exigirAcesso } from "@/lib/sessao";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** O que cada tela responde, para o atalho do painel. */
const DESCRICOES: Record<string, string> = {
  "/receita": "Procedimentos do ProDoctor por competência, bruto, glosa e líquido.",
  "/repasses": "Quanto cada profissional recebe no mês.",
  "/contas": "Títulos a pagar e a receber por vencimento.",
  "/conferencia": "Pendências, sincronizações e integridade das exportações.",
  "/cadastros": "Profissionais, convênios e de-para vindos do ProDoctor.",
  "/admin/auditoria": "Quem fez o quê no Hub.",
};

async function Conteudo() {
  const sessao = await exigirAcesso("acessar_painel");
  const atalhos = menuPara(sessao.perfis).flatMap((s) => s.itens).filter((i) => i.href !== "/painel");

  return (
    <>
      {atalhos.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Seu perfil ainda não tem telas do financeiro.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Card className="h-full transition-colors group-hover:bg-accent">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {a.rotulo}
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </CardTitle>
                  <CardDescription>{DESCRICOES[a.href]}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function Painel() {
  return (
    <div className="mx-auto w-full max-w-5xl p-8 pt-4">
      <h1 className="text-4xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-2 text-muted-foreground">Por onde começar hoje.</p>
      <Suspense
        fallback={
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <Conteudo />
      </Suspense>
    </div>
  );
}
