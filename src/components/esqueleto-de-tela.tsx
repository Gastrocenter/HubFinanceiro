import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de Suspense com o formato das telas do Hub: título, filtros, indicadores e tabelas.
 * A pessoa vê o layout chegando em vez de um "Carregando…".
 */
export function EsqueletoDeTela({
  indicadores = 0,
  tabelas = 1,
  filtros = true,
  largura = "max-w-5xl",
}: {
  indicadores?: number;
  tabelas?: number;
  filtros?: boolean;
  largura?: string;
}) {
  return (
    <div className={`mx-auto ${largura} p-8 pt-4`} aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      {filtros && (
        <div className="mt-6 flex gap-2">
          {[88, 96, 80, 92].map((w) => (
            <Skeleton key={w} className="h-8 rounded-lg" style={{ width: w }} />
          ))}
        </div>
      )}
      {indicadores > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: indicadores }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}
      {Array.from({ length: tabelas }, (_, t) => (
        <div key={t} className="mt-8">
          <Skeleton className="h-6 w-48" />
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((l) => (
              <Skeleton key={l} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
