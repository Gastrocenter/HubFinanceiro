import { arredondarParaCentavos } from "./formatar-reais";
import type { ValorExato } from "./valor";

/** Escala das alturas: milésimos do maior valor, para a barra ter resolução sem fração. */
export const ESCALA = 1000;

/**
 * Altura de cada barra em milésimos do maior valor (0 a 1000), comparando centavos em bigint, sem ponto flutuante
 * no dinheiro (ADR-0004). Valor negativo ou zero vira 0; valor positivo pequeno ganha ao menos 1, para não sumir.
 */
export function alturasDasBarras(valores: readonly ValorExato[]): number[] {
  const centavos = valores.map((v) => {
    const c = arredondarParaCentavos(v);
    return c > 0n ? c : 0n;
  });
  const maior = centavos.reduce((a, b) => (b > a ? b : a), 0n);
  if (maior === 0n) return centavos.map(() => 0);
  return centavos.map((c) => {
    if (c === 0n) return 0;
    const altura = (c * BigInt(ESCALA)) / maior;
    return altura === 0n ? 1 : Number(altura);
  });
}
