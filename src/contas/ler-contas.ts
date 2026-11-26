import { extrairRegistros } from "@/conectores/prodoctor/resposta";
import { lerValorProDoctor, type ValorExato } from "@/dominio/valor";

/**
 * Uma conta a pagar ou a receber do ProDoctor, como o Hub guarda (issue 08b). Chave: (codigoLocal, numero).
 * Sem dado de paciente (ADR-0005, D-1): de paciente fica só o tipo; nunca nome de funcionário nem dado bancário.
 */
export type RegistroDeConta = {
  codigoLocal: string;
  numero: string;
  /** Agrupa as parcelas de um mesmo lançamento. */
  lancamentoFinanceiro: string;
  contaPagarReceberPai: string;
  /** AAAA-MM-DD. O mês da sync é o desta data, que nunca muda (D-2). */
  dataInclusao: string;
  dataEfetivacao: string | null;
  dataVencimento: string | null;
  dataCompensacao: string | null;
  /** PAGAR, PAGA, RECEBER ou RECEBIDA. */
  situacao: string;
  /** Paciente, Fornecedor, Convênio ou Prestador de Serviço. */
  tipoClienteFornecedor: string;
  /** Nulo fora de TIPOS_COM_NOME, como paciente (D-1). */
  clienteFornecedor: string | null;
  /** Texto livre; nulo fora de TIPOS_COM_NOME (D-1). */
  historico: string | null;
  /** Nulo fora de TIPOS_COM_NOME (D-1). */
  numeroDocumento: string | null;
  creditoValor: ValorExato | null;
  creditoValorEfetivacao: ValorExato | null;
  debitoValor: ValorExato | null;
  debitoValorEfetivacao: ValorExato | null;
  percentualTaxa: ValorExato | null;
  grupoReceitaDespesa: string;
  nomeGrupoReceitaDespesa: string;
  contaContabil: string;
  nomeContaContabil: string;
  contaContabilEfetivacao: string;
  nomeContaContabilEfetivacao: string;
  formaEfetivacao: string;
  /** Caixa ou conta da clínica onde a conta foi efetivada. */
  conta: string;
  fatura: string;
  numRepasse: string;
};

type Bruto = Record<string, string | undefined>;

/**
 * Só estes tipos guardam nome, histórico e documento (D-1). Lista fechada, à prova de falha: paciente, tipo vazio
 * ou com outra grafia ("PACIENTE", "Paciente ") ficam sem nada. A mesma lista está na constraint do banco.
 */
export const TIPOS_COM_NOME = ["Fornecedor", "Convênio", "Prestador de Serviço"] as const;

/** Situações que o ProDoctor devolve: a natureza (pagar ou receber) sai daqui, não do sinal do valor. */
export type SituacaoDaConta = "PAGAR" | "PAGA" | "RECEBER" | "RECEBIDA";

const VALORES = ["creditoValor", "creditoValorEfetivacao", "debitoValor", "debitoValorEfetivacao", "percentualTaxa"] as const;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function obrigatorio(b: Bruto, campo: string): string {
  const v = b[campo];
  if (!v) throw new Error(`Conta a pagar/receber sem ${campo}.`);
  return v;
}

function noFormatoDeData(v: string, campo: string): string {
  if (!DATA_ISO.test(v)) throw new Error(`Conta a pagar/receber com ${campo} fora do formato AAAA-MM-DD: "${v}".`);
  return v;
}

const dataOpcional = (b: Bruto, campo: string) => (b[campo] ? noFormatoDeData(b[campo]!, campo) : null);

/** Copia campo a campo, nomeando cada um: o que é do paciente, do funcionário ou do banco nunca sai daqui. */
export function lerContas(pagina: unknown): RegistroDeConta[] {
  return extrairRegistros(pagina, "exportacao.registros").map((r) => {
    const b = r as Bruto;
    const tipoClienteFornecedor = b.tipoClienteFornecedor ?? "";
    const podeTerNome = (TIPOS_COM_NOME as readonly string[]).includes(tipoClienteFornecedor);
    const valores = Object.fromEntries(VALORES.map((c) => [c, lerValorProDoctor(b[c])])) as Pick<RegistroDeConta, (typeof VALORES)[number]>;
    return {
      codigoLocal: obrigatorio(b, "codigoLocalProDoctor"),
      numero: obrigatorio(b, "numero"),
      lancamentoFinanceiro: b.lancamentoFinanceiro ?? "",
      contaPagarReceberPai: b.contaPagarReceberPai ?? "",
      dataInclusao: noFormatoDeData(obrigatorio(b, "dataInclusao"), "dataInclusao"),
      dataEfetivacao: dataOpcional(b, "dataEfetivacao"),
      dataVencimento: dataOpcional(b, "dataVencimento"),
      dataCompensacao: dataOpcional(b, "dataCompensacao"),
      situacao: b.situacao ?? "",
      tipoClienteFornecedor,
      clienteFornecedor: podeTerNome ? (b.clienteFornecedor ?? "") : null,
      historico: podeTerNome ? (b.historico ?? "") : null,
      numeroDocumento: podeTerNome ? (b.numeroDocumento ?? "") : null,
      creditoValor: valores.creditoValor,
      creditoValorEfetivacao: valores.creditoValorEfetivacao,
      debitoValor: valores.debitoValor,
      debitoValorEfetivacao: valores.debitoValorEfetivacao,
      percentualTaxa: valores.percentualTaxa,
      grupoReceitaDespesa: b.grupoReceitaDespesa ?? "",
      nomeGrupoReceitaDespesa: b.nomeGrupoReceitaDespesa ?? "",
      contaContabil: b.contaContabil ?? "",
      nomeContaContabil: b.nomeContaContabil ?? "",
      contaContabilEfetivacao: b.contaContabilEfetivacao ?? "",
      nomeContaContabilEfetivacao: b.nomeContaContabilEfetivacao ?? "",
      formaEfetivacao: b.formaEfetivacao ?? "",
      conta: b.conta ?? "",
      fatura: b.fatura ?? "",
      numRepasse: b.numRepasse ?? "",
    };
  });
}
