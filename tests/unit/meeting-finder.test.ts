import { describe, expect, it } from "vitest";
import { slotOf } from "@/contracts/availability";
import {
  addDays,
  daysBetween,
  isValidDateKey,
  mondayOf,
  todayIn,
  weekdayOf,
  zonedInstant,
  zonedParts,
} from "@/components/features/meetings/calendar-dates";
import {
  slotAt,
  suggestMeetingTimes,
  weekAvailability,
  weekHeatmap,
  type FinderMember,
} from "@/server/services/meetings/meeting-finder";

const CHI = "America/Chicago";
const NY = "America/New_York";
const LON = "Europe/London";

/** Slots for [fromHour, toHour) on a weekday (0 = Mon). */
function hours(day: number, fromHour: number, toHour: number): number[] {
  const out: number[] = [];
  for (let h = fromHour * 2; h < toHour * 2; h++) out.push(slotOf(day, h));
  return out;
}

const base = { durationMinutes: 60, earliestHour: 8, latestHour: 22, busy: [], limit: 10 };

describe("calendar-dates", () => {
  it("does calendar arithmetic without DST drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-26", "2026-11-08")).toBe(13);
    expect(weekdayOf("2026-10-29")).toBe(3); // Thursday
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // Sunday → previous Monday
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-10-29")).toBe(true);
    expect(todayIn(CHI, new Date("2026-10-23T03:00:00Z"))).toBe("2026-10-22");
  });

  it("converts wall-clock time in a zone to the right instant across the US DST change", () => {
    expect(zonedInstant("2026-10-29", 19 * 60, CHI).toISOString()).toBe("2026-10-30T00:00:00.000Z"); // CDT −5
    expect(zonedInstant("2026-11-02", 19 * 60, CHI).toISOString()).toBe("2026-11-03T01:00:00.000Z"); // CST −6
    expect(zonedParts(new Date("2026-10-30T00:30:00Z"), LON)).toMatchObject({ weekday: 4, hours: 0, minutes: 30 });
    expect(slotAt(Date.parse("2026-10-30T00:00:00Z"), CHI)).toBe(slotOf(3, 38)); // Thu 19:00 Chicago
  });
});

describe("PB-06 suggestMeetingTimes", () => {
  it("AC1: ranks the slot where all 4 members are free first", () => {
    const members: FinderMember[] = ["a", "b", "c", "d"].map((id) => ({
      userId: id,
      timezone: CHI,
      slots: hours(3, 19, 20),
    }));
    members[3].slots.push(...hours(3, 15, 16)); // d alone is also free Thu 3 pm
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-10-26", to: "2026-11-01" });
    expect(res[0]).toMatchObject({
      startsAt: "2026-10-30T00:00:00.000Z", // Thu Oct 29, 7 pm CDT
      endsAt: "2026-10-30T01:00:00.000Z",
      availableCount: 4,
      totalMembers: 4,
      unavailableUserIds: [],
    });
    expect(res[1]).toMatchObject({ availableCount: 1, availableUserIds: ["d"] });
  });

  it("AC2: a New York member free 8–9 pm Eastern is free for 7–8 pm Central", () => {
    const members: FinderMember[] = [
      { userId: "chi", timezone: CHI, slots: hours(3, 19, 20) },
      { userId: "ny", timezone: NY, slots: hours(3, 20, 21) },
    ];
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-10-29", to: "2026-10-29" });
    expect(res[0]).toMatchObject({ startsAt: "2026-10-30T00:00:00.000Z", availableCount: 2 });
  });

  it("AC3: stays correct across DST — London member's Fri 00:00 matches Thu 7 pm CT only before Nov 1", () => {
    // UK clocks changed Oct 25; US clocks change Nov 1. Thu Oct 29 7 pm CDT = Fri 00:00 GMT,
    // but Thu Nov 5 7 pm CST = Fri 01:00 GMT.
    const members: FinderMember[] = [
      { userId: "chi", timezone: CHI, slots: hours(3, 19, 20) },
      { userId: "lon", timezone: LON, slots: hours(4, 0, 1) },
    ];
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-10-29", to: "2026-11-05" });
    const oct29 = res.find((s) => s.startsAt === "2026-10-30T00:00:00.000Z");
    const nov5 = res.find((s) => s.startsAt === "2026-11-06T01:00:00.000Z");
    expect(oct29?.availableUserIds.sort()).toEqual(["chi", "lon"]);
    expect(nov5?.availableUserIds).toEqual(["chi"]);
  });

  it("AC3: Sunday Nov 1 morning in Chicago maps to the right instant (after fall-back)", () => {
    const members: FinderMember[] = [{ userId: "a", timezone: CHI, slots: hours(6, 10, 11) }];
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-11-01", to: "2026-11-01" });
    expect(res.map((r) => r.startsAt)).toEqual(["2026-11-01T16:00:00.000Z"]); // 10 am CST = 16:00Z
  });

  it("AC4: never suggests a time that overlaps an existing team meeting", () => {
    const members: FinderMember[] = [{ userId: "a", timezone: CHI, slots: hours(3, 18, 21) }];
    const busy = [{ startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-10-30T01:00:00Z") }]; // 7–8 pm
    const res = suggestMeetingTimes({
      ...base,
      members,
      busy,
      viewerTimeZone: CHI,
      from: "2026-10-29",
      to: "2026-10-29",
    });
    for (const s of res) {
      const start = Date.parse(s.startsAt);
      const end = Date.parse(s.endsAt);
      expect(start < Date.parse("2026-10-30T01:00:00Z") && end > Date.parse("2026-10-30T00:00:00Z")).toBe(false);
    }
    expect(res.map((s) => s.startsAt)).toContain("2026-10-29T23:00:00.000Z"); // 6–7 pm
    expect(res.map((s) => s.startsAt)).toContain("2026-10-30T01:00:00.000Z"); // 8–9 pm
  });

  it("requires every 30-minute cell of a longer meeting to be free", () => {
    const members: FinderMember[] = [{ userId: "a", timezone: CHI, slots: [slotOf(3, 38), slotOf(3, 40)] }]; // gap at 19:30
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-10-29", to: "2026-10-29" });
    expect(res).toEqual([]);
    const half = suggestMeetingTimes({
      ...base,
      durationMinutes: 30,
      members,
      viewerTimeZone: CHI,
      from: "2026-10-29",
      to: "2026-10-29",
    });
    expect(half).toHaveLength(2);
  });

  it("collapses one long free block into separate, non-overlapping suggestions", () => {
    const members: FinderMember[] = [{ userId: "a", timezone: CHI, slots: hours(3, 18, 21) }];
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-10-29", to: "2026-10-29" });
    expect(res.map((s) => s.startsAt)).toEqual([
      "2026-10-29T23:00:00.000Z",
      "2026-10-30T00:00:00.000Z",
      "2026-10-30T01:00:00.000Z",
    ]);
  });

  it("handles empty availability, impossible windows, past times, and limits", () => {
    const empty: FinderMember[] = [{ userId: "a", timezone: CHI, slots: [] }];
    expect(
      suggestMeetingTimes({ ...base, members: empty, viewerTimeZone: CHI, from: "2026-10-29", to: "2026-10-29" }),
    ).toEqual([]);
    const free: FinderMember[] = [{ userId: "a", timezone: CHI, slots: hours(3, 8, 22) }];
    expect(
      suggestMeetingTimes({
        ...base,
        durationMinutes: 240,
        earliestHour: 20,
        latestHour: 22,
        members: free,
        viewerTimeZone: CHI,
        from: "2026-10-29",
        to: "2026-10-29",
      }),
    ).toEqual([]);
    expect(
      suggestMeetingTimes({ ...base, members: free, viewerTimeZone: CHI, from: "2026-10-30", to: "2026-10-29" }),
    ).toEqual([]);
    const afterNoon = suggestMeetingTimes({
      ...base,
      members: free,
      viewerTimeZone: CHI,
      from: "2026-10-29",
      to: "2026-10-29",
      now: new Date("2026-10-29T17:00:00Z"),
    });
    expect(afterNoon.every((s) => Date.parse(s.startsAt) > Date.parse("2026-10-29T17:00:00Z"))).toBe(true);
    expect(
      suggestMeetingTimes({
        ...base,
        limit: 2,
        members: free,
        viewerTimeZone: CHI,
        from: "2026-10-29",
        to: "2026-10-29",
      }),
    ).toHaveLength(2);
  });

  it("AC9 (NFR-01): 8 members over 14 days in under 300 ms", () => {
    const zones = [CHI, NY, LON, "America/Los_Angeles"];
    const members: FinderMember[] = Array.from({ length: 8 }, (_, i) => ({
      userId: `m${i}`,
      timezone: zones[i % zones.length],
      slots: Array.from({ length: 7 }, (_, d) => hours(d, 9 + (i % 3), 22)).flat(),
    }));
    const t0 = performance.now();
    const res = suggestMeetingTimes({ ...base, members, viewerTimeZone: CHI, from: "2026-10-26", to: "2026-11-08" });
    expect(performance.now() - t0).toBeLessThan(300);
    expect(res.length).toBeGreaterThan(0);
  });
});

describe("PB-06 week heatmap", () => {
  it("counts who is free in each viewer-zone cell", () => {
    const members: FinderMember[] = [
      { userId: "chi", timezone: CHI, slots: hours(3, 19, 20) },
      { userId: "ny", timezone: NY, slots: hours(3, 20, 21) },
    ];
    const counts = weekHeatmap(members, "2026-10-26", CHI);
    expect(counts).toHaveLength(336);
    expect(counts[slotOf(3, 38)]).toBe(2);
    expect(counts[slotOf(3, 39)]).toBe(2);
    expect(counts[slotOf(3, 40)]).toBe(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
    expect(weekAvailability(members, "2026-10-26", CHI)[slotOf(3, 38)]).toEqual(["chi", "ny"]);
  });
});
