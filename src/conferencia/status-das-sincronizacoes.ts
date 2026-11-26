import { ROTA_PROCEDIMENTOS } from "@/receita/normalizar";
import { ROTA_REPASSES } from "@/repasse/normalizar";

export type JobDaFila = {
  empresa: string;
  rota: string;
  estado: "pendente" | "executando" | "concluido" | "falhou";
  concluidoEm: string | null;
  atualizadoEm: string;
  ultimoErro: string | null;
};

export type StatusDaRota = {
  empresa: string;
  rota: string;
  nome: string;
  ultimaConclusao: string | null;
  /** Jobs que falharam depois da última conclusão (falha já superada não conta). */
  falhas: number;
  ultimoErro: string | null;
  /** Sem concluir nada há mais de 24 h (com folga) ou nunca: o agendamento diário pode ter parado. */
  parado: boolean;
};

const NOMES: Record<string, string> = {
  [ROTA_PROCEDIMENTOS]: "Procedimentos",
  [ROTA_REPASSES]: "Repasses",
  "/api/v1/Usuarios": "Profissionais",
  "/api/v1/Convenios": "Convênios",
  "/api/v1/LocaisProDoctor": "Unidades",
};

/** Rotas que o agendamento diário deve rodar: aparecem mesmo sem nenhum job no período (e aí estão paradas). */
export const ROTAS_DO_AGENDAMENTO = Object.keys(NOMES);

/**
 * 24 h mais 2 h de folga (D-F): o agendamento roda uma vez por dia e a fila anda a cada 15 min, então duas
 * conclusões seguidas ficam a ~24 h uma da outra; sem folga, um atraso pequeno daria "parado" quase todo dia.
 */
const LIMITE_PARADO = 26 * 60 * 60 * 1000;
const instante = (iso: string) => new Date(iso).getTime();

export function statusDasSincronizacoes(
  jobs: readonly JobDaFila[],
  agora: Date,
  esperados: { empresas: readonly string[]; rotas: readonly string[] } = { empresas: [], rotas: [] },
): StatusDaRota[] {
  const chave = (empresa: string, rota: string) => JSON.stringify([empresa, rota]);
  const grupos = new Map<string, { empresa: string; rota: string; jobs: JobDaFila[] }>();
  for (const empresa of esperados.empresas) {
    for (const rota of esperados.rotas) grupos.set(chave(empresa, rota), { empresa, rota, jobs: [] });
  }
  for (const j of jobs) {
    const k = chave(j.empresa, j.rota);
    if (!grupos.has(k)) grupos.set(k, { empresa: j.empresa, rota: j.rota, jobs: [] });
    grupos.get(k)!.jobs.push(j);
  }

  return [...grupos.values()]
    .map(({ empresa, rota, jobs: doGrupo }) => {
      const conclusoes = doGrupo.flatMap((j) => (j.estado === "concluido" && j.concluidoEm ? [j.concluidoEm] : []));
      const ultimaConclusao = conclusoes.reduce<string | null>((a, b) => (a === null || instante(b) > instante(a) ? b : a), null);
      const falhas = doGrupo
        .filter((j) => j.estado === "falhou" && (ultimaConclusao === null || instante(j.atualizadoEm) > instante(ultimaConclusao)))
        .sort((a, b) => instante(a.atualizadoEm) - instante(b.atualizadoEm));
      return {
        empresa,
        rota,
        nome: NOMES[rota] ?? rota,
        ultimaConclusao,
        falhas: falhas.length,
        ultimoErro: falhas.at(-1)?.ultimoErro ?? null,
        parado: ultimaConclusao === null || agora.getTime() - instante(ultimaConclusao) > LIMITE_PARADO,
      };
    })
    .sort((a, b) => a.empresa.localeCompare(b.empresa) || a.nome.localeCompare(b.nome, "pt-BR"));
}
