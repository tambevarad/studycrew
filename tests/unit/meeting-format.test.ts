import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDayLong,
  formatDayShort,
  formatTimeRange,
  formatWhen,
  monthShort,
  zoneAbbreviation,
} from "@/components/features/meetings/format";

const CHI = "America/Chicago";
const at = (iso: string) => new Date(iso);

describe("PB-06 hydration-safe formatting", () => {
  it("uses only plain spaces and a spaced en dash (no ICU-version-specific characters)", () => {
    const outputs = [
      formatClock(at("2026-10-30T00:00:00Z"), CHI),
      formatTimeRange(at("2026-10-29T23:30:00Z"), at("2026-10-30T00:30:00Z"), CHI),
      formatTimeRange(at("2026-10-29T16:00:00Z"), at("2026-10-29T17:30:00Z"), CHI),
      formatWhen(at("2026-10-30T00:00:00Z"), CHI),
      formatDayLong(at("2026-10-30T00:00:00Z"), CHI, true),
    ];
    for (const s of outputs) expect(s).not.toMatch(/[   ]/);
  });

  it("formats clocks and ranges", () => {
    expect(formatClock(at("2026-10-30T00:00:00Z"), CHI)).toBe("7:00 PM");
    expect(formatClock(at("2026-10-30T05:00:00Z"), CHI)).toBe("12:00 AM");
    expect(formatTimeRange(at("2026-10-29T23:30:00Z"), at("2026-10-30T00:30:00Z"), CHI)).toBe("6:30 – 7:30 PM");
    expect(formatTimeRange(at("2026-10-29T16:00:00Z"), at("2026-10-29T17:30:00Z"), CHI)).toBe("11:00 AM – 12:30 PM");
  });

  it("formats days, zones, and notification text in the given zone", () => {
    expect(formatDayShort(at("2026-10-30T00:00:00Z"), CHI)).toBe("Thu, Oct 29");
    expect(formatDayLong(at("2026-10-30T00:00:00Z"), CHI)).toBe("Thursday, October 29");
    expect(formatDayLong(at("2026-10-30T00:00:00Z"), CHI, true)).toBe("Thursday, October 29, 2026");
    expect(zoneAbbreviation(at("2026-10-30T00:00:00Z"), CHI)).toBe("CDT");
    expect(zoneAbbreviation(at("2026-11-03T01:00:00Z"), CHI)).toBe("CST");
    expect(formatWhen(at("2026-10-30T00:00:00Z"), "America/New_York")).toBe("Thu, Oct 29, 8:00 PM EDT");
    expect(monthShort(1)).toBe("Jan");
    expect(monthShort(12)).toBe("Dec");
  });
});
