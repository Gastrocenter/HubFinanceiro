import { extrairRegistros } from "@/conectores/prodoctor/resposta";
import { lerValorProDoctor, type ValorExato } from "@/dominio/valor";

/**
 * Um procedimento realizado, como o Hub guarda: sem nenhum dado de paciente (ADR-0005).
 * Chave natural: (empresa, codigoLocal, conta, linha) — D-N.
 */
export type RegistroDeProcedimento = {
  codigoLocal: string;
  conta: string;
  linha: string;
  fatura: string;
  data: string;
  nomeProfissional: string;
  nomeConvenio: string;
  /** Especialidade do profissional (não é dado de paciente). */
  especialidade: string;
  funcao: string;
  funcaoRepasse: string;
  codigoProcedimento: string;
  descricaoProcedimento: string;
  tipoProcedimento: string;
  grupoProcedimentosRepasses: string;
  quantidade: ValorExato | null;
  valorTotal: ValorExato | null;
  valorDiferenca: ValorExato | null;
  valorGlosa: ValorExato | null;
  valorRecuperado: ValorExato | null;
  totalMateriaisMedicamentos: ValorExato | null;
  totalTaxasDiarias: ValorExato | null;
  totalGlosasMateriaisMedicamentos: ValorExato | null;
  totalGlosasTaxasDiarias: ValorExato | null;
  totalRecuperadoMateriaisMedicamentos: ValorExato | null;
  totalRecuperadoTaxasDiarias: ValorExato | null;
  naoRepassar: boolean;
  somenteRepasse: boolean;
  naoIncluirRepasse: boolean;
};

type Bruto = Record<string, string | undefined>;

const VALORES = [
  "quantidade", "valorTotal", "valorDiferenca", "valorGlosa", "valorRecuperado",
  "totalMateriaisMedicamentos", "totalTaxasDiarias", "totalGlosasMateriaisMedicamentos", "totalGlosasTaxasDiarias",
  "totalRecuperadoMateriaisMedicamentos", "totalRecuperadoTaxasDiarias",
] as const;

function simNao(campo: string, v: string | undefined): boolean {
  if (v === "Sim") return true;
  if (v === "Não") return false;
  throw new Error(`Procedimento com ${campo} inesperado: "${v}" (esperado "Sim" ou "Não").`);
}

function obrigatorio(b: Bruto, campo: string): string {
  const v = b[campo];
  if (!v) throw new Error(`Procedimento sem ${campo}.`);
  return v;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function lerProcedimentos(pagina: unknown): RegistroDeProcedimento[] {
  return extrairRegistros(pagina, "exportacao.registros").map((r) => {
    const b = r as Bruto;
    const data = obrigatorio(b, "data");
    if (!DATA_ISO.test(data)) throw new Error(`Procedimento com data fora do formato AAAA-MM-DD: "${data}".`);
    const valores = Object.fromEntries(VALORES.map((c) => [c, lerValorProDoctor(b[c])])) as Pick<RegistroDeProcedimento, (typeof VALORES)[number]>;
    return {
      codigoLocal: obrigatorio(b, "codigoLocalProDoctor"),
      conta: obrigatorio(b, "conta"),
      linha: obrigatorio(b, "linhaProcedimento"),
      fatura: b.fatura ?? "",
      data,
      nomeProfissional: b.usuario ?? "",
      nomeConvenio: b.convenio ?? "",
      especialidade: b.usuarioEspecialidade ?? "",
      funcao: b.funcao ?? "",
      funcaoRepasse: b.funcaoRepasse ?? "",
      codigoProcedimento: b.codigoProcedimento ?? "",
      descricaoProcedimento: b.descricaoProcedimento ?? "",
      tipoProcedimento: b.tipoProcedimento ?? "",
      grupoProcedimentosRepasses: b.grupoProcedimentosRepasses ?? "",
      ...valores,
      naoRepassar: simNao("naoRepassar", b.naoRepassar),
      somenteRepasse: simNao("somenteRepasse", b.somenteRepasse),
      naoIncluirRepasse: simNao("naoIncluirRepasse", b.naoIncluirRepasse),
    };
  });
}
