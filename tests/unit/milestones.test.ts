import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import { dateInputValue, endOfDayIso, percent, spreadDueDates } from "@/components/features/milestones/progress";

const CHI = "America/Chicago";
const wallClock = (d: Date, tz = CHI) => {
  const z = new TZDate(d.getTime(), tz);
  return { day: z.getDate(), month: z.getMonth() + 1, hours: z.getHours(), minutes: z.getMinutes() };
};

describe("percent", () => {
  it("AC2: rounds done / total, and is 0 with no tasks", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 5)).toBe(100);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("spreadDueDates", () => {
  it("AC1: count dates, strictly increasing, the last exactly on the final date", () => {
    const from = new Date("2026-11-02T16:00:00Z");
    const to = new Date(endOfDayIso("2026-11-20", CHI)!);
    const dates = spreadDueDates(5, from, to, CHI);
    expect(dates).toHaveLength(5);
    for (let i = 1; i < dates.length; i++) expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
    expect(dates.at(-1)?.toISOString()).toBe(to.toISOString());
    expect(dates[0].getTime()).toBeGreaterThan(from.getTime());
  });

  it("puts each milestone on a whole day at the final date's time of day, across the DST change", () => {
    const from = new Date("2026-10-20T15:00:00Z"); // CDT
    const to = new Date(endOfDayIso("2026-11-20", CHI)!); // CST: clocks went back on Nov 1
    const dates = spreadDueDates(4, from, to, CHI);
    for (const d of dates) expect(wallClock(d)).toMatchObject({ hours: 23, minutes: 59 });
    expect(dates.map((d) => `${wallClock(d).month}/${wallClock(d).day}`)).toEqual(["10/27", "11/4", "11/12", "11/20"]);
  });

  it("with less than a day per milestone, spreads evenly to the minute and stays increasing", () => {
    const from = new Date("2026-11-02T12:00:00Z");
    const to = new Date("2026-11-04T12:00:00Z"); // 2 days for 5 milestones
    const dates = spreadDueDates(5, from, to, CHI);
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-11-02T21:36:00.000Z",
      "2026-11-03T07:12:00.000Z",
      "2026-11-03T16:48:00.000Z",
      "2026-11-04T02:24:00.000Z",
      "2026-11-04T12:00:00.000Z",
    ]);
  });

  it("returns nothing for zero milestones", () => {
    expect(spreadDueDates(0, new Date(), new Date(Date.now() + 1e9), CHI)).toEqual([]);
  });
});

describe("endOfDayIso / dateInputValue", () => {
  it("round-trips a day in the viewer's zone", () => {
    const iso = endOfDayIso("2026-11-05", CHI);
    expect(iso).toBe("2026-11-06T05:59:00.000Z");
    expect(dateInputValue(iso, CHI)).toBe("2026-11-05");
    expect(dateInputValue(iso, "Asia/Kolkata")).toBe("2026-11-06");
  });

  it("handles empty and malformed input", () => {
    expect(endOfDayIso("", CHI)).toBeNull();
    expect(endOfDayIso("Nov 5", CHI)).toBeNull();
    expect(dateInputValue(null, CHI)).toBe("");
  });
});
