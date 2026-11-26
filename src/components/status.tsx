import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export type Tom = "sucesso" | "atencao" | "erro" | "neutro" | "info";

// O texto puxa 25% para a cor do texto da página: escurece no claro e clareia no escuro, e passa de 4.5:1
// nos dois temas (o tom puro sobre o próprio fundo translúcido ficava em ~3.7:1 no claro).
const TONS: Record<Tom, string> = {
  sucesso: "bg-success/15 text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))]",
  atencao: "bg-warning/30 text-foreground",
  erro: "bg-destructive/12 text-[color-mix(in_srgb,var(--destructive)_75%,var(--foreground))]",
  neutro: "bg-secondary text-secondary-foreground",
  info: "bg-info/15 text-[color-mix(in_srgb,var(--info)_75%,var(--foreground))]",
};

/**
 * Etiqueta de estado do Hub (conferido, parada, não bate, a revisar…). O texto sempre diz o estado:
 * a cor só reforça, nunca é a única pista.
 */
export function Status({
  tom,
  children,
  className,
  title,
}: {
  tom: Tom;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <Badge data-tom={tom} title={title} className={cn("font-medium", TONS[tom], className)}>
      {children}
    </Badge>
  );
}
