const NOMES_DOS_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "out/2026": o rótulo de mês das telas. */
export function rotuloDoMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${NOMES_DOS_MESES[Number(m) - 1]}/${ano}`;
}
