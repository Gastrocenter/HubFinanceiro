import { MARCACOES, type Marcacao } from "./sugerir-marcacao";

/** Valor que o formulário envia por linha exibida: `id:sugestão`. */
export const valorExibido = (id: number, sugestao: Marcacao) => `${id}:${sugestao}`;

/** Lê um `valorExibido`; valor malformado vira null. */
function lerValorExibido(valor: string): { id: number; sugestao: Marcacao } | null {
  const [idTexto, sugestao, ...resto] = valor.split(":");
  if (resto.length > 0 || !/^\d+$/.test(idTexto ?? "")) return null;
  const marcacao = MARCACOES.find((m) => m === sugestao);
  return marcacao ? { id: Number(idTexto), sugestao: marcacao } : null;
}

/**
 * Das sugestões que a pessoa viu na tela (`exibidas`), devolve só as que ainda valem: o profissional continua a
 * revisar e a sugestão de agora (`atuais`) é a mesma que ela viu. Quem entrou ou mudou depois do clique fica de
 * fora (code-review item 6), assim nenhuma marcação sai com o usuário de alguém que não a viu.
 */
export function sugestoesAplicaveis(
  exibidas: readonly string[],
  atuais: ReadonlyMap<number, Marcacao | null>,
): { id: number; ehMedico: boolean }[] {
  const aplicar: { id: number; ehMedico: boolean }[] = [];
  const vistos = new Set<number>();
  for (const valor of exibidas) {
    const lido = lerValorExibido(valor);
    if (!lido || vistos.has(lido.id) || atuais.get(lido.id) !== lido.sugestao) continue;
    vistos.add(lido.id);
    aplicar.push({ id: lido.id, ehMedico: lido.sugestao === "medico" });
  }
  return aplicar;
}
