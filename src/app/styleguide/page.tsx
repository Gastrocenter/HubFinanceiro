import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const metadata = { title: "Design system · Hub Financeiro" };

const passos = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

const tokensBase = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "secondary",
  "muted",
  "muted-foreground",
  "accent",
  "destructive",
  "border",
  "input",
  "ring",
  "sidebar",
] as const;

const semanticos = [
  { nome: "success", rotulo: "Sucesso", Icone: CheckCircle2 },
  { nome: "warning", rotulo: "Atenção", Icone: TriangleAlert },
  { nome: "destructive", rotulo: "Erro", Icone: AlertCircle },
  { nome: "info", rotulo: "Informação", Icone: Info },
] as const;

const tiles = [
  { nome: "tile-yellow", rotulo: "Recebíveis", valor: "R$ 48.210", classe: "bg-tile-yellow" },
  { nome: "tile-pink", rotulo: "Repasses", valor: "R$ 21.930", classe: "bg-tile-pink" },
  { nome: "tile-olive", rotulo: "Conferidos", valor: "312", classe: "bg-tile-olive" },
  { nome: "tile-blue", rotulo: "Pendências", valor: "7", classe: "bg-tile-blue" },
] as const;

const raios = [
  { nome: "sm", classe: "rounded-sm" },
  { nome: "md", classe: "rounded-md" },
  { nome: "lg", classe: "rounded-lg" },
  { nome: "xl", classe: "rounded-xl" },
  { nome: "2xl", classe: "rounded-2xl" },
  { nome: "full", classe: "rounded-full" },
] as const;

const sombras = ["shadow-none", "shadow-xs", "shadow-sm", "shadow-md", "shadow-lg"] as const;

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{titulo}</h2>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

function Amostra({ variavel, rotulo }: { variavel: string; rotulo?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-16 rounded-xl border border-foreground/10"
        style={{ background: `var(--${variavel})` }}
      />
      <div className="text-xs">
        <div className="font-medium">{rotulo ?? variavel}</div>
        <code className="font-mono text-muted-foreground">--{variavel}</code>
      </div>
    </div>
  );
}

function Escala({ prefixo, titulo }: { prefixo: string; titulo: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{titulo}</h3>
      <div className="grid grid-cols-10 overflow-hidden rounded-xl border border-foreground/10">
        {passos.map((p) => (
          <div key={p} className="flex flex-col">
            <div className="h-14" style={{ background: `var(--${prefixo}-${p})` }} />
            <code className="px-1.5 py-1 font-mono text-[11px] text-muted-foreground">{p}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-14 px-10 py-12">
      <header>
        <p className="text-sm text-muted-foreground">Fundação</p>
        <h1 className="mt-1 text-5xl font-semibold tracking-tight">Design tokens</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Creme quente de fundo, tinta quase preta para ações, rosa como cor de marca e tiles pastel
          para indicadores. Os valores vivem em <code className="font-mono text-sm">src/app/globals.css</code>.
        </p>
      </header>

      <Secao titulo="Paleta" descricao="Tokens semânticos do shadcn, usados pelos componentes.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {tokensBase.map((t) => (
            <Amostra key={t} variavel={t} />
          ))}
        </div>
      </Secao>

      <Secao titulo="Escalas" descricao="Marca (rosa) e neutro quente, de 50 a 900. Utilitários: brand-* e sand-*.">
        <Escala prefixo="brand" titulo="Marca" />
        <Escala prefixo="neutral" titulo="Neutro (sand)" />
      </Secao>

      <Secao titulo="Semânticas" descricao="Estado de conferência, pendências e avisos.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {semanticos.map(({ nome, rotulo, Icone }) => (
            <div
              key={nome}
              className="flex items-center gap-3 rounded-xl p-4"
              style={{ background: `var(--${nome})`, color: `var(--${nome}-foreground, #fff)` }}
            >
              <Icone className="size-5" />
              <div className="text-sm">
                <div className="font-medium">{rotulo}</div>
                <code className="font-mono text-xs opacity-80">--{nome}</code>
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tiles de indicador" descricao="Cards pastel do painel; texto sempre em tinta (--tile-foreground).">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.nome} className={`${t.classe} rounded-2xl p-5 text-tile-foreground`}>
              <div className="text-lg font-medium">{t.rotulo}:</div>
              <div className="mt-4 text-2xl font-semibold tracking-tight">{t.valor}</div>
              <code className="mt-1 block font-mono text-xs opacity-70">--{t.nome}</code>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const).map((c) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <span className="size-4 rounded-full" style={{ background: `var(--${c})` }} />
              <code className="font-mono text-muted-foreground">--{c}</code>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia" descricao="Plus Jakarta Sans, números tabulares. Títulos com tracking apertado.">
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6">
          <div className="text-5xl font-semibold tracking-tight">Bom dia, equipe</div>
          <div className="text-3xl font-semibold tracking-tight">Resumo de repasses</div>
          <div className="text-2xl font-medium tracking-tight">Contas a receber</div>
          <div className="text-lg font-medium">Lista de pendências</div>
          <p className="max-w-2xl text-base">
            Corpo de texto em 16px. O Hub tem 45 recebíveis aguardando conferência hoje e uma divergência
            com o ProDoctor.
          </p>
          <p className="text-sm text-muted-foreground">Texto auxiliar em 14px, muted-foreground.</p>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Rótulo · 12px</p>
          <p className="font-mono text-sm">1EG4-TE5-MK72 · Geist Mono</p>
        </div>
      </Secao>

      <Secao titulo="Raios e sombras" descricao="--radius: 1rem. Design plano: sombra só no que flutua.">
        <div className="flex flex-wrap gap-6">
          {raios.map((r) => (
            <div key={r.nome} className="flex flex-col items-center gap-2">
              <div className={`size-20 border-2 border-foreground/70 bg-accent ${r.classe}`} />
              <code className="font-mono text-xs text-muted-foreground">rounded-{r.nome}</code>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6">
          {sombras.map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={`size-24 rounded-xl bg-popover ${s}`} />
              <code className="font-mono text-xs text-muted-foreground">{s}</code>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Componentes" descricao="shadcn/ui (Nova, Radix) sobre os tokens acima.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Adicionar lançamento</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive">Excluir</Button>
          <Button variant="link">Ver todos</Button>
          <Button size="lg" className="rounded-full px-6">
            Pílula grande
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge>Conferido</Badge>
          <Badge variant="secondary">Rascunho</Badge>
          <Badge variant="outline">Unimed</Badge>
          <Badge variant="destructive">Divergente</Badge>
          <Badge className="bg-accent text-accent-foreground">Repasse</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Repasse de maio</CardTitle>
              <CardDescription>Dr. Everly · 38 procedimentos</CardDescription>
              <CardAction>
                <Badge variant="outline">Aberto</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tracking-tight">R$ 12.480,00</CardContent>
            <CardFooter className="gap-2">
              <Button>Fechar repasse</Button>
              <Button variant="ghost">Detalhes</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Período</CardTitle>
              <CardDescription>Escolha a janela da conferência.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup defaultValue="mes" className="gap-3">
                {[
                  { v: "hoje", r: "Hoje" },
                  { v: "semana", r: "Esta semana" },
                  { v: "mes", r: "Este mês" },
                ].map(({ v, r }) => (
                  <label key={v} className="flex items-center gap-3 text-sm">
                    <RadioGroupItem value={v} id={`periodo-${v}`} />
                    {r}
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3">
          <Alert>
            <Info />
            <AlertTitle>Sincronização concluída</AlertTitle>
            <AlertDescription>412 procedimentos importados do ProDoctor às 08:12.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Divergência encontrada</AlertTitle>
            <AlertDescription>3 recebíveis não batem com o ProDoctor e viraram pendência.</AlertDescription>
          </Alert>
        </div>
      </Secao>
    </div>
  );
}
