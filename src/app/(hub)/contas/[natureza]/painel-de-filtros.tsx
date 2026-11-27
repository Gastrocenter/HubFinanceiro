"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  alternar,
  comFiltros,
  SITUACOES,
  type FiltrosDeContas,
  type SituacaoDoFiltro,
  type TipoDeData,
} from "@/contas/filtros";
import { ATALHOS_DE_PERIODO, periodoDoAtalho, type AtalhoDePeriodo } from "@/contas/periodo";

const ROTULO_DO_ATALHO: Record<AtalhoDePeriodo, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "esta-semana": "Esta semana",
  "este-mes": "Este mês",
  "mes-passado": "Mês passado",
};

/** Painel lateral de filtros (D-6). Só escreve no endereço ao aplicar: a página relê tudo do servidor. */
export function PainelDeFiltros({ caminho, filtros, hoje, ligados, rotuloEfetivacao, rotuloEfetivada, rotuloPessoa, categorias }: {
  caminho: string;
  filtros: FiltrosDeContas;
  hoje: string;
  ligados: number;
  rotuloEfetivacao: string;
  rotuloEfetivada: string;
  rotuloPessoa: string;
  categorias: { slug: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState(filtros);
  const muda = (m: Partial<FiltrosDeContas>) => setRascunho((r) => ({ ...r, ...m }));
  const periodoValido = rascunho.de !== "" && rascunho.ate !== "" && rascunho.de <= rascunho.ate;

  const aplicar = (f: FiltrosDeContas) => {
    setAberto(false);
    router.push(comFiltros(caminho, f, {}, hoje));
  };

  const rotuloDaSituacao: Record<SituacaoDoFiltro, string> = { aberta: "Em aberto", efetivada: rotuloEfetivada, vencida: "Vencida" };
  const tipos: { valor: TipoDeData; rotulo: string }[] = [
    { valor: "vencimento", rotulo: "Vencimento" },
    { valor: "entrada", rotulo: "Entrada" },
    { valor: "efetivacao", rotulo: rotuloEfetivacao },
  ];

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setRascunho(filtros);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal data-icon="inline-start" />
          Filtros{ligados > 0 && <span className="tabular-nums"> · {ligados}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Valem para os cartões, as categorias e a tabela.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Período</legend>
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS_DE_PERIODO.map((a) => (
                <Button key={a} type="button" variant="outline" size="sm" onClick={() => muda(periodoDoAtalho(a, hoje))}>
                  {ROTULO_DO_ATALHO[a]}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Label className="flex flex-col items-start gap-1 text-xs">
                De
                <Input type="date" value={rascunho.de} onChange={(e) => muda({ de: e.target.value })} />
              </Label>
              <Label className="flex flex-col items-start gap-1 text-xs">
                Até
                <Input type="date" value={rascunho.ate} onChange={(e) => muda({ ate: e.target.value })} />
              </Label>
            </div>
            {!periodoValido && <p className="text-xs text-destructive">Escolha as duas datas, com o início antes do fim.</p>}
            <p className="text-xs text-muted-foreground">Para um dia só, use a mesma data nos dois campos.</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Data usada no período</legend>
            <RadioGroup value={rascunho.tipoDeData} onValueChange={(v) => muda({ tipoDeData: v as TipoDeData })}>
              {tipos.map((t) => (
                <Label key={t.valor} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={t.valor} />
                  {t.rotulo}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Situação</legend>
            <div className="flex flex-col gap-2">
              {SITUACOES.map((s) => (
                <Label key={s} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={rascunho.situacoes.includes(s)}
                    onCheckedChange={() => muda({ situacoes: SITUACOES.filter((x) => alternar(rascunho.situacoes, s).includes(x)) })}
                  />
                  {rotuloDaSituacao[s]}
                </Label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Nenhuma marcada mostra todas.</p>
          </fieldset>

          {categorias.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Categoria</legend>
              <div className="flex flex-col gap-2">
                {categorias.map((c) => (
                  <Label key={c.slug} className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={rascunho.categorias.includes(c.slug)}
                      onCheckedChange={() => muda({ categorias: alternar(rascunho.categorias, c.slug) })}
                    />
                    {c.nome}
                  </Label>
                ))}
              </div>
            </fieldset>
          )}

          <Label className="flex flex-col items-start gap-1 text-sm font-medium">
            {rotuloPessoa}
            <Input
              type="search"
              value={rascunho.fornecedor ?? ""}
              onChange={(e) => muda({ fornecedor: e.target.value.trim() ? e.target.value : null })}
              placeholder="Parte do nome"
            />
          </Label>
        </div>

        <SheetFooter className="flex-row justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => aplicar({ ...filtros, ...periodoDoAtalho("este-mes", hoje), tipoDeData: "vencimento", situacoes: [], categorias: [], fornecedor: null })}
          >
            Limpar
          </Button>
          <Button type="button" disabled={!periodoValido} onClick={() => aplicar({ ...rascunho, fornecedor: rascunho.fornecedor?.trim() || null })}>
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
