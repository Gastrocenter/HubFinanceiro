import { describe, expect, it } from "vitest";
import { rotuloDoMes } from "./rotulo-do-mes";

describe("rotuloDoMes", () => {
  it("mês AAAA-MM vira o rótulo curto das telas", () => {
    expect(rotuloDoMes("2026-10")).toBe("out/2026");
    expect(rotuloDoMes("2025-01")).toBe("jan/2025");
  });
});
