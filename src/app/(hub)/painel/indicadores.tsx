import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "cn";
import { formatarCentavos, formatarReais } from "@/dominio/formatar-reais";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { Skeleton } from "@/components/ui/skeleton";
import { contarPendenciasAbertas, lerReceitaPorMes, mesCorrente, lerRepasseDoMes, lerSaudeDasSincronizacoes } from "./dados";

const FUNDOS = {
  amarelo: "bg-tile-yellow",
  rosa: "bg-tile-pink",
  oliva: "bg-tile-olive",
  azul: "bg-tile-blue",
} as const;

/** Tile pastel do design: rótulo, número grande e uma linha de contexto. O tile inteiro leva à tela. */
function Indicador({
  href,
  fundo,
  rotulo,
  valor,
  detalhe,
}: {
  href: string;
  fundo: keyof typeof FUNDOS;
  rotulo: string;
  valor: string;
  detalhe: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-36 flex-col rounded-3xl p-5 text-tile-foreground transition-[filter] hover:brightness-95",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        FUNDOS[fundo],
      )}
    >
      <span className="flex items-center justify-between text-sm font-medium">
        {rotulo}
        <ArrowUpRight className="size-4 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      </span>
      <span className="mt-auto pt-4 text-3xl font-semibold tracking-tight tabular-nums">{valor}</span>
      <span className="mt-1 text-sm text-tile-foreground/85">{detalhe}</span>
    </Link>
  );
}

export function IndicadorCarregando() {
  return <Skeleton className="min-h-36 rounded-3xl" />;
}

export async function IndicadorDeReceita() {
  const meses = await lerReceitaPorMes();
  const atual = meses.at(-1);
  if (!atual) {
    return <Indicador href="/receita" fundo="amarelo" rotulo="Receita líquida" valor="—" detalhe="Nenhuma receita sincronizada" />;
  }
  return (
    <Indicador
      href={`/receita?mes=${atual.mes}`}
      fundo="amarelo"
      rotulo={`Receita líquida · ${rotuloDoMes(atual.mes)}`}
      valor={formatarReais(atual.liquido)}
      detalhe={
        atual.mes === mesCorrente()
          ? `Mês em andamento · ${atual.procedimentos} procedimentos até hoje`
          : `${atual.procedimentos} procedimentos, glosa de ${formatarReais(atual.glosa)}`
      }
    />
  );
}

export async function IndicadorDeRepasse() {
  const repasse = await lerRepasseDoMes();
  if (!repasse) {
    return <Indicador href="/repasses" fundo="rosa" rotulo="Repasse a pagar" valor="—" detalhe="Nenhum lote de repasse sincronizado" />;
  }
  return (
    <Indicador
      href={`/repasses?mes=${repasse.mes}`}
      fundo="rosa"
      rotulo={`Repasse a pagar · ${rotuloDoMes(repasse.mes)}`}
      valor={formatarCentavos(repasse.centavos)}
      detalhe={`${repasse.titulos} ${repasse.titulos === 1 ? "título" : "títulos"} de profissionais`}
    />
  );
}

export async function IndicadorDePendencias() {
  const abertas = await contarPendenciasAbertas();
  return (
    <Indicador
      href="/conferencia"
      fundo="azul"
      rotulo="Pendências abertas"
      valor={String(abertas)}
      detalhe={abertas === 0 ? "Tudo conferido com o ProDoctor" : "Divergências com o ProDoctor a revisar"}
    />
  );
}

export async function IndicadorDeSincronizacoes() {
  const { total, paradas } = await lerSaudeDasSincronizacoes();
  const emDia = total - paradas.length;
  return (
    <Indicador
      href="/conferencia"
      fundo="oliva"
      rotulo="Sincronizações em dia"
      valor={`${emDia} de ${total}`}
      detalhe={
        <span className="flex items-center gap-1.5">
          {paradas.length === 0 ? (
            <>
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              Todas rodaram nas últimas 24 h
            </>
          ) : (
            <>
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              <span className="truncate" title={paradas.join(", ")}>
                Parada: {paradas.join(", ")}
              </span>
            </>
          )}
        </span>
      }
    />
  );
}
