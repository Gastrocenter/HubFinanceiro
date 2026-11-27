/**
 * Datas do filtro de período das contas (issue 11, D-6). Tudo em data de calendário ISO ("2026-11-26") no
 * fuso de São Paulo; "hoje" entra por parâmetro para o teste não depender do relógio.
 */

export type Periodo = { de: string; ate: string };

export const ATALHOS_DE_PERIODO = ["hoje", "ontem", "esta-semana", "este-mes", "mes-passado"] as const;
export type AtalhoDePeriodo = (typeof ATALHOS_DE_PERIODO)[number];

/** O dia de calendário em São Paulo no instante dado. */
export const hojeEmSaoPaulo = (agora: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);

/** Data ISO válida de verdade ("2026-02-30" não é). */
export function ehDataIso(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return paraIso(deIso(texto)) === texto;
}

// Aritmética de calendário em UTC, onde não há horário de verão: só o dia importa.
const deIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paraIso = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (iso: string, dias: number) => {
  const d = deIso(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraIso(d);
};
const mesInteiro = (ano: number, mes0: number): Periodo => ({
  de: paraIso(new Date(Date.UTC(ano, mes0, 1))),
  ate: paraIso(new Date(Date.UTC(ano, mes0 + 1, 0))),
});

/** O período de um atalho. "Esta semana" vai de segunda a domingo; os meses vão do dia 1 ao último. */
export function periodoDoAtalho(atalho: AtalhoDePeriodo, hoje: string): Periodo {
  const d = deIso(hoje);
  switch (atalho) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "ontem": {
      const ontem = somarDias(hoje, -1);
      return { de: ontem, ate: ontem };
    }
    case "esta-semana": {
      const desdeSegunda = (d.getUTCDay() + 6) % 7;
      const segunda = somarDias(hoje, -desdeSegunda);
      return { de: segunda, ate: somarDias(segunda, 6) };
    }
    case "este-mes":
      return mesInteiro(d.getUTCFullYear(), d.getUTCMonth());
    case "mes-passado":
      return mesInteiro(d.getUTCFullYear(), d.getUTCMonth() - 1);
  }
}
