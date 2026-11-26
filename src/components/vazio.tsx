import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "cn";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Estado vazio: diz o que não há e, quando der, o que fazer ou quando volta a ter. */
export function Vazio({
  titulo,
  descricao,
  icone: Icone = Inbox,
  children,
  className,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  icone?: LucideIcon;
  /** Ação opcional (um link ou botão). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("mt-4 rounded-2xl border border-dashed bg-card/50 py-10", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icone />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        {descricao && <EmptyDescription>{descricao}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
