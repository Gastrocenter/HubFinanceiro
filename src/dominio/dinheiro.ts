/** Converte número pt-BR ("1.234,56") em centavos. Rejeita entrada ambígua em vez de adivinhar. */
export function parseBRLEmCentavos(entrada: string): number {
  const texto = entrada.trim();
  if (!/^-?\d{1,3}(\.\d{3})*,\d{2}$|^-?\d+,\d{2}$/.test(texto)) {
    throw new Error(`Valor monetário inválido ou ambíguo: "${entrada}"`);
  }
  const negativo = texto.startsWith("-");
  const [inteiro, centavos] = texto.replace("-", "").replace(/\./g, "").split(",");
  const total = Number(inteiro) * 100 + Number(centavos);
  return negativo ? -total : total;
}
