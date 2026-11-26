import type { RegistroDeOrigem } from "./ler-cadastros";

/** O que o Hub já sabe de um cadastro de origem (uma empresa, um tipo). */
export type CadastroAtual = {
  codigoOrigem: string;
  nome: string;
  ativo: boolean;
  vistoNaUltimaSync: boolean;
};

export type PlanoDeReconciliacao = {
  criar: RegistroDeOrigem[];
  atualizar: { codigoOrigem: string; nome?: string; ativo?: boolean }[];
  sumiram: string[];
  voltaram: string[];
};

export function reconciliar(atuais: CadastroAtual[], vindos: RegistroDeOrigem[]): PlanoDeReconciliacao {
  // Proteção: cadastro vazio com Hub já povoado é quase certamente falha da API, não exclusão em massa.
  if (vindos.length === 0 && atuais.some((a) => a.vistoNaUltimaSync)) {
    throw new Error("Cadastro veio vazio do ProDoctor, mas o Hub já tem registros: reconciliação recusada.");
  }
  const porCodigo = new Map(atuais.map((a) => [a.codigoOrigem, a]));
  const plano: PlanoDeReconciliacao = { criar: [], atualizar: [], sumiram: [], voltaram: [] };

  for (const vindo of vindos) {
    const existente = porCodigo.get(vindo.codigoOrigem);
    if (!existente) {
      plano.criar.push(vindo);
      continue;
    }
    if (!existente.vistoNaUltimaSync) plano.voltaram.push(vindo.codigoOrigem);
    const mudanca: PlanoDeReconciliacao["atualizar"][number] = { codigoOrigem: vindo.codigoOrigem };
    if (vindo.nome !== existente.nome) mudanca.nome = vindo.nome;
    if (vindo.ativo !== existente.ativo) mudanca.ativo = vindo.ativo;
    if (Object.keys(mudanca).length > 1) plano.atualizar.push(mudanca);
  }

  // Sumiu do ProDoctor: marca (L3), nunca apaga. Quem já estava sumido não entra de novo.
  const vindosCodigos = new Set(vindos.map((v) => v.codigoOrigem));
  plano.sumiram = atuais.filter((a) => a.vistoNaUltimaSync && !vindosCodigos.has(a.codigoOrigem)).map((a) => a.codigoOrigem);
  return plano;
}
