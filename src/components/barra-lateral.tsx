"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LayoutDashboard, LogOut } from "lucide-react";
import { iconeDe } from "@/components/icones-do-menu";
import { sair } from "@/app/login/acoes";
import { itemAtivo, type SecaoDoMenu } from "@/dominio/menu";
import type { Perfil } from "@/dominio/permissoes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";

const ROTULO_DO_PERFIL: Record<Perfil, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  aprovador: "Aprovador",
  restrito: "Restrito",
};

const iniciais = (email: string) => email.split("@")[0].slice(0, 2).toUpperCase() || "?";

function Marca() {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <Link href="/painel">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                H
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-base font-semibold tracking-tight">Hub Financeiro</span>
                <span className="text-xs text-sidebar-foreground/60">Gastrocenter</span>
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

export function BarraLateral({
  menu,
  usuario,
}: {
  menu: SecaoDoMenu[];
  usuario: { email: string; perfis: readonly Perfil[] } | null;
}) {
  const pathname = usePathname();
  const hrefAtivo = itemAtivo(pathname, menu.flatMap((s) => s.itens.map((i) => i.href)));

  return (
    <Sidebar variant="floating" collapsible="icon">
      <Marca />

      <SidebarContent>
        {menu.map((secao) => (
          <SidebarGroup key={secao.titulo}>
            <SidebarGroupLabel>{secao.titulo}</SidebarGroupLabel>
            <SidebarMenu>
              {secao.itens.map((item) => {
                const Icone = iconeDe(item.href) ?? LayoutDashboard;
                const ativo = item.href === hrefAtivo;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={ativo}
                      tooltip={item.rotulo}
                      className="data-active:text-sidebar-primary"
                    >
                      <Link href={item.href} aria-current={ativo ? "page" : undefined}>
                        <Icone />
                        <span>{item.rotulo}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {usuario && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" aria-label={`Conta de ${usuario.email}`}>
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs text-sidebar-accent-foreground">
                        {iniciais(usuario.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm">{usuario.email}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {usuario.perfis.map((p) => ROTULO_DO_PERFIL[p]).join(", ")}
                      </span>
                    </span>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="truncate text-sm text-foreground">{usuario.email}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {usuario.perfis.map((p) => ROTULO_DO_PERFIL[p]).join(", ") || "Sem perfil ativo"}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <form action={sair}>
                    <DropdownMenuItem asChild>
                      <button type="submit" className="w-full">
                        <LogOut />
                        Sair
                      </button>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}

/** Enquanto a sessão carrega: a mesma moldura, com itens-esqueleto. */
export function BarraLateralCarregando() {
  return (
    <Sidebar variant="floating" collapsible="icon">
      <Marca />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {["60%", "80%", "70%", "85%", "65%"].map((largura, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuSkeleton showIcon width={largura} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
