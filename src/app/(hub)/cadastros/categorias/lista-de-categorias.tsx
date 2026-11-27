"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { BotaoDeEnvio, FormularioDeAcao } from "@/components/formulario-de-acao";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LIMITE_DO_NOME, type Natureza } from "@/contas/categorias";
import { salvarCategoria } from "./acoes";

export type CategoriaComUso = { id: number; nome: string; itens: number };

/** Diálogo de criar (sem `categoria`) ou renomear uma categoria. */
function EditarCategoria({ natureza, categoria }: { natureza: Natureza; categoria?: CategoriaComUso }) {
  const [aberto, setAberto] = useState(false);
  // Controlado: o React limpa campos não controlados depois da action, e o texto se perderia num erro.
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const idDoCampo = `nome-categoria-${categoria?.id ?? "nova"}`;
  const lista = natureza === "pagar" ? "a pagar" : "a receber";

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setNome(categoria?.nome ?? "");
      }}
    >
      <DialogTrigger asChild>
        {categoria ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Renomear ${categoria.nome}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus data-icon="inline-start" />
            Nova categoria
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <FormularioDeAcao acao={salvarCategoria} aoConcluir={() => setAberto(false)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{categoria ? "Renomear categoria" : `Nova categoria ${lista}`}</DialogTitle>
            <DialogDescription>
              {categoria
                ? `Os ${categoria.itens} itens ligados a ela continuam ligados; só o nome muda.`
                : "Entra no fim da lista. Depois, ligue os itens a ela pela tabela abaixo."}
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="natureza" value={natureza} />
          {categoria && <input type="hidden" name="id" value={categoria.id} />}
          <Field>
            <FieldLabel htmlFor={idDoCampo}>Nome</FieldLabel>
            <Input
              id={idDoCampo}
              name="nome"
              required
              maxLength={LIMITE_DO_NOME}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="off"
            />
            <FieldDescription>Fica no log de auditoria com o seu usuário.</FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <BotaoDeEnvio disabled={nome.trim() === "" || nome.trim() === categoria?.nome}>
              {categoria ? "Renomear" : "Criar"}
            </BotaoDeEnvio>
          </DialogFooter>
        </FormularioDeAcao>
      </DialogContent>
    </Dialog>
  );
}

export function ListaDeCategorias({ natureza, categorias }: { natureza: Natureza; categorias: CategoriaComUso[] }) {
  return (
    <section className="mt-6" aria-labelledby="titulo-categorias">
      <div className="flex items-center justify-between gap-4">
        <h2 id="titulo-categorias" className="text-base font-semibold">
          Categorias {natureza === "pagar" ? "a pagar" : "a receber"}
        </h2>
        <EditarCategoria natureza={natureza} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center gap-1 rounded-lg border bg-card py-0.5 pr-0.5 pl-3 text-sm">
            <span>{c.nome}</span>
            <span className="text-xs text-muted-foreground tabular-nums" aria-label={`${c.itens} itens`}>
              · {c.itens}
            </span>
            <EditarCategoria natureza={natureza} categoria={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}
