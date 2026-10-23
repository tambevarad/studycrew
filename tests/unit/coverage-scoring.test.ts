import { describe, expect, it } from "vitest";
import type { CoverageStatusValue } from "@/contracts/coverage";
import { countByStatus, scoreItems } from "@/server/ai/scoring";

const items = (...statuses: CoverageStatusValue[]) => statuses.map((status) => ({ status }));

describe("PB-10 scoring", () => {
  it("AC8: score = round((covered + 0.5 × partial) / n × 100)", () => {
    expect(scoreItems(items("COVERED", "PARTIAL", "MISSING"))).toBe(50);
    expect(scoreItems(items("COVERED", "COVERED", "PARTIAL"))).toBe(83); // 2.5 / 3 = 83.3
    expect(scoreItems(items("COVERED", "PARTIAL", "PARTIAL", "MISSING", "MISSING", "MISSING"))).toBe(33); // 2 / 6
    expect(scoreItems(items("PARTIAL", "MISSING", "MISSING", "MISSING", "MISSING", "MISSING", "MISSING", "MISSING"))).toBe(6); // 6.25
    expect(scoreItems(items("COVERED"))).toBe(100);
    expect(scoreItems(items("MISSING", "MISSING"))).toBe(0);
  });

  it("AC8: score is 0 when there are no items", () => {
    expect(scoreItems([])).toBe(0);
  });

  it("counts every status, including zeros", () => {
    expect(countByStatus(items("COVERED", "MISSING", "MISSING"))).toEqual({ COVERED: 1, PARTIAL: 0, MISSING: 2 });
    expect(countByStatus([])).toEqual({ COVERED: 0, PARTIAL: 0, MISSING: 0 });
  });
});
