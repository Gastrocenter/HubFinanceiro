import { describe, expect, it } from "vitest";
import { empresasConfiguradas } from "./empresas";

describe("empresasConfiguradas", () => {
  it("lista as empresas com chave e senha do ProDoctor, ignorando credencial incompleta", () => {
    const ambiente = {
      PRODOCTOR_STELLA_CENTRAL_APIKEY: "a",
      PRODOCTOR_STELLA_CENTRAL_APIPASSWORD: "b",
      PRODOCTOR_SABIN_APIKEY: "c", // sem senha: não entra
      PRODOCTOR_VAZIA_APIKEY: "",
      PRODOCTOR_VAZIA_APIPASSWORD: "",
      OUTRA_COISA: "x",
    };
    expect(empresasConfiguradas(ambiente)).toEqual(["STELLA_CENTRAL"]);
  });
});
