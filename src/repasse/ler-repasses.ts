import { extrairRegistros } from "@/conectores/prodoctor/resposta";
import { lerValorProDoctor, type ValorExato } from "@/dominio/valor";

/**
 * Uma linha de repasse do ProDoctor, como o Hub guarda: sem nenhum dado de paciente (ADR-0005).
 * Chave: o procedimento (codigoLocal, conta, linha), que aparece uma vez nos repasses.
 * O ProDoctor já calculou os valores; o Hub não recalcula (D2).
 */
export type RegistroDeRepasse = {
  codigoLocal: string;
  conta: string;
  linha: string;
  /** Lote do ProDoctor. */
  numeroRepasse: string;
  /** AAAA-MM-DD; o período da exportação filtra por esta data. */
  dataRepasse: string;
  /** Data do procedimento, AAAA-MM-DD. */
  data: string;
  fatura: string;
  tipo: string;
  nomeProfissional: string;
  nomeConvenio: string;
  codigoProcedimento: string;
  descricaoProcedimento: string;
  funcaoRepasse: string;
  /** "18 %" → "18". */
  percentualImposto: ValorExato | null;
  totalConta: ValorExato | null;
  baseCalculoBruto: ValorExato | null;
  valorImposto: ValorExato | null;
  baseCalculoLiquido: ValorExato | null;
  valorRepassado: ValorExato | null;
  /** O devido ao profissional (D2). */
  valorRepassadoMedico: ValorExato | null;
  valorRepassadoClinica: ValorExato | null;
};

type Bruto = Record<string, string | undefined>;

const VALORES = [
  "totalConta", "baseCalculoBruto", "valorImposto", "baseCalculoLiquido", "valorRepassado", "valorRepassadoMedico", "valorRepassadoClinica",
] as const;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const PERCENTUAL = /^(\d+(?:,\d+)?) ?%$/;

function obrigatorio(b: Bruto, campo: string): string {
  const v = b[campo];
  if (!v) throw new Error(`Repasse sem ${campo}.`);
  return v;
}

function data(b: Bruto, campo: string): string {
  const v = obrigatorio(b, campo);
  if (!DATA_ISO.test(v)) throw new Error(`Repasse com ${campo} fora do formato AAAA-MM-DD: "${v}".`);
  return v;
}

function percentual(texto: string | undefined): ValorExato | null {
  if (!texto) return null;
  const m = PERCENTUAL.exec(texto);
  if (!m) throw new Error(`Repasse com percentualImposto inesperado: "${texto}".`);
  return lerValorProDoctor(m[1]);
}

/** Copia campo a campo, nomeando cada um: nome e prontuário do paciente nunca saem daqui. */
export function lerRepasses(pagina: unknown): RegistroDeRepasse[] {
  return extrairRegistros(pagina, "exportacao.registros").map((r) => {
    const b = r as Bruto;
    const valores = Object.fromEntries(VALORES.map((c) => [c, lerValorProDoctor(b[c])])) as Pick<RegistroDeRepasse, (typeof VALORES)[number]>;
    return {
      codigoLocal: obrigatorio(b, "codigoLocalProDoctor"),
      conta: obrigatorio(b, "conta"),
      linha: obrigatorio(b, "linha"),
      numeroRepasse: obrigatorio(b, "numeroRepasse"),
      dataRepasse: data(b, "dataRepasse"),
      data: data(b, "data"),
      fatura: b.fatura ?? "",
      tipo: b.tipo ?? "",
      nomeProfissional: b.nomeUsuario ?? "",
      nomeConvenio: b.nomeConvenio ?? "",
      codigoProcedimento: b.codigoAmb ?? "",
      descricaoProcedimento: b.descricaoAmb ?? "",
      funcaoRepasse: b.funcaoRepasse ?? "",
      percentualImposto: percentual(b.percentualImposto),
      ...valores,
    };
  });
}
