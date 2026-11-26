import { describe, expect, it } from "vitest";
import { formatarData } from "./formatar-data";

describe("formatarData", () => {
  it("AAAA-MM-DD vira DD/MM/AAAA; sem data, um traço", () => {
    expect(formatarData("2026-10-05")).toBe("05/10/2026");
    expect(formatarData(null)).toBe("—");
  });
});
