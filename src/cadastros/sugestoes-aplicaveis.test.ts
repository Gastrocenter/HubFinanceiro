import { describe, expect, it } from "vitest";
import { sugestoesAplicaveis } from "./sugestoes-aplicaveis";

describe("sugestoesAplicaveis", () => {
  it("aplica só o que estava na tela e não mudou desde então", () => {
    const exibidas = ["10:medico", "11:nao_medico", "12:medico", "13:nao_medico"];
    const atuais = new Map([
      [10, "medico"], // igual: aplica
      [11, "medico"], // a sugestão mudou depois que a tela abriu: pula
      // 12 já foi revisado por outra pessoa (não está mais a revisar): pula
      [13, "nao_medico"], // igual: aplica
      [14, "medico"], // entrou depois que a tela abriu, nunca foi visto: pula
    ] as const);

    expect(sugestoesAplicaveis(exibidas, atuais)).toEqual([
      { id: 10, ehMedico: true },
      { id: 13, ehMedico: false },
    ]);
  });

  it("ignora valor malformado ou repetido em vez de aplicar algo que ninguém viu", () => {
    const atuais = new Map([[10, "medico"]] as const);
    expect(sugestoesAplicaveis(["10:medico", "10:medico", "x:medico", "10:talvez", "", "10", "10:medico:x", "-10:medico"], atuais)).toEqual([
      { id: 10, ehMedico: true },
    ]);
  });
});
