import { describe, expect, it } from "vitest";
import { hojeEmSaoPaulo, periodoDoAtalho } from "./periodo";

describe("hojeEmSaoPaulo", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    // 02:30 UTC de 1º/dez ainda é 23:30 de 30/nov em São Paulo (UTC-3).
    expect(hojeEmSaoPaulo(new Date("2026-12-01T02:30:00Z"))).toBe("2026-11-30");
    expect(hojeEmSaoPaulo(new Date("2026-12-01T03:00:00Z"))).toBe("2026-12-01");
  });
});

describe("periodoDoAtalho", () => {
  const quinta = "2026-11-26";

  it("hoje e ontem são um dia só", () => {
    expect(periodoDoAtalho("hoje", quinta)).toEqual({ de: "2026-11-26", ate: "2026-11-26" });
    expect(periodoDoAtalho("ontem", quinta)).toEqual({ de: "2026-11-25", ate: "2026-11-25" });
  });

  it("ontem atravessa a virada do mês e do ano", () => {
    expect(periodoDoAtalho("ontem", "2026-03-01")).toEqual({ de: "2026-02-28", ate: "2026-02-28" });
    expect(periodoDoAtalho("ontem", "2027-01-01")).toEqual({ de: "2026-12-31", ate: "2026-12-31" });
  });

  it("esta semana vai de segunda a domingo", () => {
    expect(periodoDoAtalho("esta-semana", quinta)).toEqual({ de: "2026-11-23", ate: "2026-11-29" });
    expect(periodoDoAtalho("esta-semana", "2026-11-23")).toEqual({ de: "2026-11-23", ate: "2026-11-29" });
    expect(periodoDoAtalho("esta-semana", "2026-11-29")).toEqual({ de: "2026-11-23", ate: "2026-11-29" });
    expect(periodoDoAtalho("esta-semana", "2026-12-31")).toEqual({ de: "2026-12-28", ate: "2027-01-03" });
  });

  it("este mês é o mês inteiro, do dia 1 ao último", () => {
    expect(periodoDoAtalho("este-mes", quinta)).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
    expect(periodoDoAtalho("este-mes", "2028-02-10")).toEqual({ de: "2028-02-01", ate: "2028-02-29" });
  });

  it("mês passado atravessa a virada do ano", () => {
    expect(periodoDoAtalho("mes-passado", quinta)).toEqual({ de: "2026-10-01", ate: "2026-10-31" });
    expect(periodoDoAtalho("mes-passado", "2027-01-15")).toEqual({ de: "2026-12-01", ate: "2026-12-31" });
  });
});
