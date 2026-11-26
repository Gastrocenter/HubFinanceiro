import { describe, expect, it } from "vitest";
import { chaveDoRepasse, diferencaDoMesDeRepasse } from "./diferenca-do-mes-de-repasse";
import type { RegistroDeRepasse } from "./ler-repasses";

function rep(conta: string, sobrescrever: Partial<RegistroDeRepasse> = {}): RegistroDeRepasse {
  return {
    codigoLocal: "1", conta, linha: "1", numeroRepasse: "8908", dataRepasse: "2026-10-20", data: "2026-08-13", fatura: "1",
    tipo: "Repasse", nomeProfissional: "Dra. Ana Teste", nomeConvenio: "Plano Teste", codigoProcedimento: "1", descricaoProcedimento: "Consulta",
    funcaoRepasse: "", percentualImposto: "18", totalConta: "100", baseCalculoBruto: "100", valorImposto: "18", baseCalculoLiquido: "82",
    valorRepassado: "82", valorRepassadoMedico: "82", valorRepassadoClinica: "0",
    ...sobrescrever,
  };
}
const atual = (r: RegistroDeRepasse, visto = true) => ({ registro: r, vistoNaUltimaSync: visto });
const vazio = { novos: [], alterados: [], sumiram: [], voltaram: [] };

describe("diferencaDoMesDeRepasse", () => {
  it("lote novo entra como novo; lote editado traz os campos que mudaram; estornado (sumiu do mês) é marcado", () => {
    const a = rep("A");
    const b = rep("B");
    const bEditado = rep("B", { valorRepassadoMedico: "80", dataRepasse: "2026-10-21" });
    const c = rep("C", { numeroRepasse: "9000" });

    expect(diferencaDoMesDeRepasse([atual(a), atual(b)], [bEditado, c])).toEqual({
      ...vazio,
      novos: [c],
      alterados: [{ registro: bEditado, campos: ["dataRepasse", "valorRepassadoMedico"] }],
      sumiram: [chaveDoRepasse(a)],
    });
  });

  it("o mesmo procedimento em dois lotes são dois repasses: o lote refeito entra como novo e o antigo some", () => {
    const noLote1 = rep("A", { numeroRepasse: "8363", valorRepassadoMedico: "47.055" });
    const noLote2 = rep("A", { numeroRepasse: "8429", valorRepassadoMedico: "0" });

    expect(diferencaDoMesDeRepasse([atual(noLote1)], [noLote1, noLote2])).toEqual({ ...vazio, novos: [noLote2] });
    expect(diferencaDoMesDeRepasse([atual(noLote1)], [noLote2])).toEqual({
      ...vazio,
      novos: [noLote2],
      sumiram: [chaveDoRepasse(noLote1)],
    });
  });

  it("recusa mês que veio vazio quando o Hub já tem repasses nele", () => {
    expect(() => diferencaDoMesDeRepasse([atual(rep("A"))], [])).toThrow(/vazio/);
    expect(diferencaDoMesDeRepasse([atual(rep("A"), false)], [])).toEqual(vazio);
  });

  it("a chave é a do procedimento (unidade, conta, linha) mais o lote", () => {
    expect(chaveDoRepasse(rep("A"))).toBe("1:A:1:8908");
    expect(chaveDoRepasse(rep("A", { numeroRepasse: "1" }))).not.toBe(chaveDoRepasse(rep("A")));
  });
});
