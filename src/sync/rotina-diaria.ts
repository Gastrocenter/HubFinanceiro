/**
 * Rotina das 05:00: enfileirar a sincronização e expurgar o bruto de exportação (ADR-0005).
 * O expurgo roda sempre — uma falha ao enfileirar não pode deixar dado de paciente além de 120 dias.
 * Qualquer falha continua visível (o agendamento termina com erro).
 */
export async function executarRotinaDiaria<T>({
  enfileirar,
  expurgar,
}: {
  enfileirar: () => Promise<T>;
  expurgar: () => Promise<number>;
}): Promise<{ enfileirado: T; expurgadas: number }> {
  const [enfileirado, expurgo] = await Promise.allSettled([enfileirar(), expurgar()]);
  const erros = [enfileirado, expurgo].flatMap((r) => (r.status === "rejected" ? [String((r.reason as Error)?.message ?? r.reason)] : []));
  if (erros.length > 0) throw new Error(`Rotina diária falhou: ${erros.join(" | ")}`);
  return {
    enfileirado: (enfileirado as PromiseFulfilledResult<T>).value,
    expurgadas: (expurgo as PromiseFulfilledResult<number>).value,
  };
}
