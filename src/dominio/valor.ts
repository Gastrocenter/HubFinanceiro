/**
 * Valor decimal exato, como texto normalizado com ponto ("1234.56789").
 * Nunca vira `number`: ponto flutuante erra em dinheiro (ADR-0004).
 */
export type ValorExato = string;

/** Formato do ProDoctor: sinal opcional, dígitos, e vírgula decimal opcional. Sem milhar, sem ponto. */
const FORMATO_PRODOCTOR = /^-?\d+(,\d+)?$/;

/** Soma valores exatos sem ponto flutuante: inteiros escalados pela maior quantidade de casas. */
export function somarValores(valores: readonly ValorExato[]): ValorExato {
  const casas = Math.max(0, ...valores.map((v) => (v.split(".")[1] ?? "").length));
  const escala = (v: ValorExato) => {
    const negativo = v.startsWith("-");
    const [inteiro, fracao = ""] = v.replace("-", "").split(".");
    const n = BigInt(inteiro + fracao.padEnd(casas, "0"));
    return negativo ? -n : n;
  };
  const total = valores.reduce((s, v) => s + escala(v), 0n);
  const negativo = total < 0n;
  const digitos = (negativo ? -total : total).toString().padStart(casas + 1, "0");
  const inteiro = digitos.slice(0, digitos.length - casas);
  const fracao = digitos.slice(digitos.length - casas).replace(/0+$/, "");
  return `${negativo ? "-" : ""}${inteiro}${fracao ? `.${fracao}` : ""}`;
}

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
