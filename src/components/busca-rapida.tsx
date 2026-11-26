"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Search } from "lucide-react";
import { sair } from "@/app/login/acoes";
import type { GrupoDaBusca } from "@/dominio/menu";
import { iconeDe } from "@/components/icones-do-menu";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const nada = () => () => {};
/** No Mac o atalho é ⌘K; nos outros, Ctrl K (as duas teclas funcionam em qualquer sistema). O servidor mostra ⌘. */
function useEhMac() {
  return useSyncExternalStore(nada, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => true);
}

/** Busca rápida (⌘K / Ctrl K): pula para qualquer tela ou atalho que o perfil pode abrir. */
export function BuscaRapida({ grupos }: { grupos: GrupoDaBusca[] }) {
  const [aberta, setAberta] = useState(false);
  const [, iniciar] = useTransition();
  const router = useRouter();
  const ehMac = useEhMac();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberta((v) => !v);
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  const ir = (href: string) => {
    setAberta(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto gap-2 text-muted-foreground sm:w-56 sm:justify-start"
        onClick={() => setAberta(true)}
        aria-keyshortcuts={ehMac ? "Meta+K" : "Control+K"}
      >
        <Search aria-hidden />
        <span className="hidden sm:inline">Buscar tela…</span>
        <span className="sr-only sm:hidden">Buscar tela</span>
        <KbdGroup className="ml-auto hidden sm:inline-flex" aria-hidden>
          <Kbd>{ehMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>

      <CommandDialog open={aberta} onOpenChange={setAberta}>
        <CommandInput placeholder="Para onde você quer ir?" />
        <CommandList>
          <CommandEmpty>Nenhuma tela com esse nome.</CommandEmpty>
          {grupos.map((g) => (
            <CommandGroup key={g.titulo} heading={g.titulo}>
              {g.destinos.map((d) => {
                const Icone = iconeDe(d.href) ?? LayoutDashboard;
                return (
                  <CommandItem key={d.href} value={d.href} keywords={[d.rotulo, ...d.palavras]} onSelect={() => ir(d.href)}>
                    <Icone aria-hidden />
                    {d.rotulo}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Conta">
            <CommandItem
              value="sair"
              keywords={["sair", "logout", "desconectar"]}
              onSelect={() => {
                setAberta(false);
                iniciar(() => sair());
              }}
            >
              <LogOut aria-hidden />
              Sair
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
