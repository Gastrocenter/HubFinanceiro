import type { ValorExato } from "./valor";

/** Arredonda um valor exato para centavos, meio para cima (D-D). Único lugar com essa regra. */
export function arredondarParaCentavos(valor: ValorExato): bigint {
  const negativo = valor.startsWith("-");
  const [inteiro, fracao = ""] = valor.replace("-", "").split(".");
  const centavos = BigInt(inteiro) * 100n + BigInt((fracao + "00").slice(0, 2));
  const arredonda = (fracao[2] ?? "0") >= "5" ? 1n : 0n;
  const total = centavos + arredonda;
  return negativo ? -total : total;
}

/** "566865.90" → "R$ 566.865,90". Sem ponto flutuante em nenhum passo. */
export function formatarReais(valor: ValorExato | null): string {
  if (valor === null) return "—";
  return formatarCentavos(arredondarParaCentavos(valor));
}

/** Centavos inteiros (bigint ou texto, como o banco devolve) → "R$ 176,49". Não arredonda: já são centavos. */
export function formatarCentavos(centavos: bigint | string): string {
  const total = BigInt(centavos);
  const negativo = total < 0n;
  const absoluto = negativo ? -total : total;
  const reais = (absoluto / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = (absoluto % 100n).toString().padStart(2, "0");
  return `${negativo ? "-" : ""}R$ ${reais},${resto}`;
}
