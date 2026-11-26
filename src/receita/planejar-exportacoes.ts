/** Os `quantos` meses que terminam no mês de `hoje` (AAAA-MM-DD), do mais antigo ao atual, como "AAAA-MM". */
export function mesesAteHoje(hoje: string, quantos: number): string[] {
  const [ano, mes] = hoje.split("-").map(Number);
  return Array.from({ length: quantos }, (_, i) => {
    const total = ano * 12 + (mes - 1) - (quantos - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

/** Período de um mês "AAAA-MM" no formato da API do ProDoctor (dd/mm/aaaa). */
export function periodoDoMes(mes: string): { dataInicial: string; dataFinal: string } {
  const [ano, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate(); // dia 0 do mês seguinte
  const mm = String(m).padStart(2, "0");
  return { dataInicial: `01/${mm}/${ano}`, dataFinal: `${ultimoDia}/${mm}/${ano}` };
}
