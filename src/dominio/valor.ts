/**
 * Valor decimal exato, como texto normalizado com ponto ("1234.56789").
 * Nunca vira `number`: ponto flutuante erra em dinheiro (ADR-0004).
 */
export type ValorExato = string;

/** Formato do ProDoctor: sinal opcional, dígitos, e vírgula decimal opcional. Sem milhar, sem ponto. */
const FORMATO_PRODOCTOR = /^-?\d+(,\d+)?$/;

/**
 * Lê um valor numérico do ProDoctor sem perder casas decimais.
 * Texto vazio ou ausente é "não informado" (null), nunca zero (ADR-0004).
 * Formato fora do padrão é rejeitado em vez de adivinhado (L8).
 */
export function lerValorProDoctor(texto: string | null | undefined): ValorExato | null {
  if (texto === null || texto === undefined || texto === "") return null;
  if (!FORMATO_PRODOCTOR.test(texto)) {
    throw new Error(`Valor do ProDoctor com formato inesperado: "${texto}"`);
  }
  return texto.replace(",", ".");
}
