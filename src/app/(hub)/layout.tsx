import { Suspense } from "react";
import { BarraLateral, BarraLateralCarregando } from "@/components/barra-lateral";
import { Trilha } from "@/components/trilha";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BuscaRapida } from "@/components/busca-rapida";
import { buscaPara, menuPara } from "@/dominio/menu";
import { carregarSessao } from "@/lib/sessao";

/** Lê a sessão (a mesma leitura da página, por `cache`) só para montar o menu; o acesso continua na página. */
async function BarraComSessao() {
  const sessao = await carregarSessao();
  return (
    <BarraLateral
      menu={sessao ? menuPara(sessao.perfis) : []}
      usuario={sessao ? { email: sessao.email, perfis: sessao.perfis } : null}
    />
  );
}

/** A busca rápida só oferece o que o perfil pode abrir; sem sessão, não aparece. */
async function BuscaComSessao() {
  const sessao = await carregarSessao();
  return sessao ? <BuscaRapida grupos={buscaPara(sessao.perfis)} /> : null;
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Suspense fallback={<BarraLateralCarregando />}>
          <BarraComSessao />
        </Suspense>
        <SidebarInset className="bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" aria-label="Mostrar ou esconder o menu" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Suspense>
              <Trilha />
            </Suspense>
            <Suspense>
              <BuscaComSessao />
            </Suspense>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
